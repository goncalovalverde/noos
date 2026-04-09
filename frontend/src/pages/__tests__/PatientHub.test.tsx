import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { mockPatient, handlers } from '@/test/mocks/handlers'
import PatientHub from '@/pages/PatientHub'
import { useAuthStore } from '@/store/auth'

vi.mock('@/store/auth', () => ({ useAuthStore: vi.fn() }))

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mockNeuroUser = {
  id: '1', username: 'neuro', role: 'Neuropsicólogo',
  can_manage_protocols: false, is_active: true,
  full_name: 'Ana García', email: null, last_login: null,
}

function renderHub(patientId = mockPatient.id) {
  vi.mocked(useAuthStore).mockReturnValue({
    user: mockNeuroUser, token: 'fake', isAuthenticated: true,
    login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
  })
  return render(
    <MemoryRouter initialEntries={[`/patients/${patientId}`]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientHub />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PatientHub', () => {
  it('shows loading state initially', () => {
    renderHub()
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('renders patient display_id in header', async () => {
    renderHub()
    expect(await screen.findByText('JMR (1234)')).toBeInTheDocument()
  })

  it('renders patient demographics', async () => {
    renderHub()
    await screen.findByText('JMR (1234)')
    expect(screen.getByText(/65/)).toBeInTheDocument()
    expect(screen.getByText(/diestro/i)).toBeInTheDocument()
  })

  it('shows 404 state for unknown patient', async () => {
    renderHub('unknown-id')
    expect(await screen.findByText(/no encontrado/i)).toBeInTheDocument()
  })

  it('shows Nueva Evaluacion button for Neuropsicólogo', async () => {
    renderHub()
    await screen.findByText('JMR (1234)')
    expect(screen.getByRole('link', { name: /nueva evaluaci/i })).toBeInTheDocument()
  })

  it('hides Nueva Evaluacion button for Observador', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { ...mockNeuroUser, role: 'Observador' },
      token: 'fake', isAuthenticated: true, login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={[`/patients/${mockPatient.id}`]}>
        <Routes><Route path="/patients/:id" element={<PatientHub />} /></Routes>
      </MemoryRouter>
    )
    await screen.findByText('JMR (1234)')
    expect(screen.queryByRole('link', { name: /nueva evaluaci/i })).not.toBeInTheDocument()
  })

  it('renders test session type in history', async () => {
    renderHub()
    await screen.findByText('JMR (1234)')
    expect(await screen.findByText('TMT-A')).toBeInTheDocument()
  })

  it('renders PE score', async () => {
    renderHub()
    await screen.findByText('JMR (1234)')
    await screen.findByText('TMT-A')
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
  })

  it('shows empty state when no sessions', async () => {
    server.use(http.get('/api/patients/:id/sessions', () => HttpResponse.json([])))
    renderHub()
    await screen.findByText('JMR (1234)')
    expect(await screen.findByText(/sin evaluaciones/i)).toBeInTheDocument()
  })

  it('shows back link to patient list', async () => {
    renderHub()
    await screen.findByText('JMR (1234)')
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument()
  })
})
