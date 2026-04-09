import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers } from '@/test/mocks/handlers'
import PatientList from '@/pages/PatientList'
import { useAuthStore } from '@/store/auth'

// Mock auth store so we don't need real JWT
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}))

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mockNeuroUser = {
  id: '1', username: 'neuro', role: 'Neuropsicólogo',
  can_manage_protocols: false, is_active: true,
  full_name: 'Ana García', email: null, last_login: null,
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PatientList', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockNeuroUser, token: 'fake-token',
      isAuthenticated: true, login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
    })
  })

  it('shows loading state initially', () => {
    renderWithRouter(<PatientList />)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('renders patient list after loading', async () => {
    renderWithRouter(<PatientList />)
    expect(await screen.findByText('JMR (1234)')).toBeInTheDocument()
  })

  it('shows patient age and education', async () => {
    renderWithRouter(<PatientList />)
    await screen.findByText('JMR (1234)')
    expect(screen.getByText(/65/)).toBeInTheDocument()
  })

  it('shows empty state when no patients', async () => {
    server.use(http.get('/api/patients/', () => HttpResponse.json([])))
    renderWithRouter(<PatientList />)
    expect(await screen.findByText(/no hay pacientes/i)).toBeInTheDocument()
  })

  it('shows error state on API failure', async () => {
    server.use(http.get('/api/patients/', () => HttpResponse.json({ detail: 'Error' }, { status: 500 })))
    renderWithRouter(<PatientList />)
    expect(await screen.findByText(/error/i)).toBeInTheDocument()
  })

  it('shows "Nuevo paciente" button for Neuropsicólogo', async () => {
    renderWithRouter(<PatientList />)
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeInTheDocument()
  })

  it('hides "Nuevo paciente" button for Observador', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { ...mockNeuroUser, role: 'Observador' },
      token: 'fake', isAuthenticated: true, login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
    })
    renderWithRouter(<PatientList />)
    expect(screen.queryByRole('button', { name: /nuevo paciente/i })).not.toBeInTheDocument()
  })

  it('opens create patient modal when button clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<PatientList />)
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('PatientForm (create)', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockNeuroUser, token: 'fake-token',
      isAuthenticated: true, login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
    })
  })

  it('submits valid patient data', async () => {
    const user = userEvent.setup()
    renderWithRouter(<PatientList />)
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))

    await user.type(screen.getByLabelText(/edad/i), '65')
    await user.type(screen.getByLabelText(/años.*educación|educación/i), '12')
    await user.click(screen.getByRole('button', { name: /guardar|crear/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
