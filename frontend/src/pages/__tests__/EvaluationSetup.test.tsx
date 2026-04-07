import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { mockPatient, mockProtocol, mockPlan, handlers } from '@/test/mocks/handlers'
import EvaluationSetup from '@/pages/EvaluationSetup'
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

function renderSetup() {
  vi.mocked(useAuthStore).mockReturnValue({
    user: mockNeuroUser, token: 'fake', isAuthenticated: true,
    login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
  })
  return render(
    <MemoryRouter initialEntries={[`/patients/${mockPatient.id}/evaluate`]}>
      <Routes>
        <Route path="/patients/:id/evaluate" element={<EvaluationSetup />} />
        <Route path="/patients/:id/evaluate/:planId" element={<div>Session Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EvaluationSetup', () => {
  it('shows protocol selection options', async () => {
    renderSetup()
    expect(await screen.findByText(/protocolo/i)).toBeInTheDocument()
  })

  it('shows available protocols', async () => {
    renderSetup()
    expect(await screen.findByText('Rastreio Cognitivo')).toBeInTheDocument()
  })

  it('shows mode selector', async () => {
    renderSetup()
    await screen.findByText('Rastreio Cognitivo')
    expect(screen.getByText(/en vivo|live|papel|paper/i)).toBeInTheDocument()
  })

  it('shows test count for protocol', async () => {
    renderSetup()
    await screen.findByText('Rastreio Cognitivo')
    expect(screen.getByText(/3.*test|test.*3/i)).toBeInTheDocument()
  })

  it('shows start button after selecting protocol', async () => {
    const user = userEvent.setup()
    renderSetup()
    await screen.findByText('Rastreio Cognitivo')
    await user.click(screen.getByText('Rastreio Cognitivo'))
    expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument()
  })

  it('navigates to session after starting evaluation', async () => {
    const user = userEvent.setup()
    renderSetup()
    await screen.findByText('Rastreio Cognitivo')
    await user.click(screen.getByText('Rastreio Cognitivo'))
    await user.click(screen.getByRole('button', { name: /iniciar/i }))
    await waitFor(() => expect(screen.getByText('Session Page')).toBeInTheDocument())
  })
})
