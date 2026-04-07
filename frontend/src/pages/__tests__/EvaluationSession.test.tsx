import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setupServer } from 'msw/node'
import { mockPatient, mockPlan, handlers } from '@/test/mocks/handlers'
import EvaluationSession from '@/pages/EvaluationSession'
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

function renderSession() {
  vi.mocked(useAuthStore).mockReturnValue({
    user: mockNeuroUser, token: 'fake', isAuthenticated: true,
    login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
  })
  return render(
    <MemoryRouter initialEntries={[`/patients/${mockPatient.id}/evaluate/${mockPlan.id}`]}>
      <Routes>
        <Route path="/patients/:id/evaluate/:planId" element={<EvaluationSession />} />
        <Route path="/patients/:id/evaluate/:planId/summary" element={<div>Summary Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EvaluationSession', () => {
  it('shows loading state initially', () => {
    renderSession()
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('shows current test name after loading', async () => {
    renderSession()
    expect(await screen.findByText('TMT-A')).toBeInTheDocument()
  })

  it('shows progress indicator', async () => {
    renderSession()
    await screen.findByText('TMT-A')
    expect(screen.getByText(/1.*3|test.*1/i)).toBeInTheDocument()
  })

  it('shows save and continue button', async () => {
    renderSession()
    await screen.findByText('TMT-A')
    expect(screen.getByRole('button', { name: /guardar.*continuar|continuar/i })).toBeInTheDocument()
  })

  it('shows skip button', async () => {
    renderSession()
    await screen.findByText('TMT-A')
    expect(screen.getByRole('button', { name: /omitir/i })).toBeInTheDocument()
  })

  it('shows time input for TMT-A', async () => {
    renderSession()
    await screen.findByText('TMT-A')
    expect(screen.getByLabelText(/tiempo|segundos/i)).toBeInTheDocument()
  })

  it('shows timer for live mode', async () => {
    renderSession()
    await screen.findByText('TMT-A')
    expect(screen.getByText(/cronómetro|timer|00:/i)).toBeInTheDocument()
  })

  it('shows observations textarea', async () => {
    renderSession()
    await screen.findByText('TMT-A')
    expect(screen.getByPlaceholderText(/observaciones/i)).toBeInTheDocument()
  })

  it('advances to next test after saving', async () => {
    const user = userEvent.setup()
    renderSession()
    await screen.findByText('TMT-A')
    const input = screen.getByLabelText(/tiempo|segundos/i)
    await user.type(input, '60')
    await user.click(screen.getByRole('button', { name: /guardar.*continuar|continuar/i }))
    await waitFor(() => expect(screen.getByText('Fluidez-FAS')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('skipping test advances to next', async () => {
    const user = userEvent.setup()
    renderSession()
    await screen.findByText('TMT-A')
    await user.click(screen.getByRole('button', { name: /omitir/i }))
    await waitFor(() => expect(screen.getByText('Fluidez-FAS')).toBeInTheDocument())
  })

  it('navigates to summary after last test', async () => {
    const user = userEvent.setup()
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/execution-plans/:id', () => HttpResponse.json({
        ...mockPlan,
        test_customizations: [{ test_type: 'TMT-A', order: 1, skip: false, added: false, repeat_later: false, notes: '' }]
      }))
    )
    renderSession()
    await screen.findByText('TMT-A')
    const input = screen.getByLabelText(/tiempo|segundos/i)
    await user.type(input, '60')
    await user.click(screen.getByRole('button', { name: /guardar.*continuar|continuar/i }))
    await waitFor(() => expect(screen.getByText('Summary Page')).toBeInTheDocument(), { timeout: 3000 })
  })
})
