import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setupServer } from 'msw/node'
import { mockPatient, mockCompletedPlan, handlers } from '@/test/mocks/handlers'
import EvaluationSummary from '@/pages/EvaluationSummary'

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { role: 'Neuropsicólogo', can_manage_protocols: false }, logout: vi.fn() })
  ),
}))

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderSummary() {
  return render(
    <MemoryRouter
      initialEntries={[`/patients/${mockPatient.id}/evaluate/${mockCompletedPlan.id}/summary`]}
    >
      <Routes>
        <Route
          path="/patients/:id/evaluate/:planId/summary"
          element={<EvaluationSummary />}
        />
        <Route path="/patients/:id" element={<div>Patient Hub</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EvaluationSummary', () => {
  it('shows loading state', () => {
    renderSummary()
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('renders patient display_id in header', async () => {
    renderSummary()
    expect(await screen.findByText(mockPatient.display_id)).toBeInTheDocument()
  })

  it('renders results table with test types', async () => {
    renderSummary()
    await waitFor(() => {
      expect(screen.getByText('TMT-A')).toBeInTheDocument()
      expect(screen.getByText('Fluidez-FAS')).toBeInTheDocument()
    })
  })

  it('renders PE scores', async () => {
    renderSummary()
    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('13')).toBeInTheDocument()
    })
  })

  it('renders percentile values', async () => {
    renderSummary()
    await waitFor(() => {
      expect(screen.getByText('25.0')).toBeInTheDocument()
      expect(screen.getByText('84.0')).toBeInTheDocument()
    })
  })

  it('renders classification badges', async () => {
    renderSummary()
    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument()
      expect(screen.getByText('Superior')).toBeInTheDocument()
    })
  })

  it('renders radar chart container', async () => {
    renderSummary()
    await waitFor(() => {
      expect(screen.getByTestId('cognitive-radar')).toBeInTheDocument()
    })
  })

  it('shows Descargar PDF button', async () => {
    renderSummary()
    expect(await screen.findByRole('button', { name: /descargar pdf/i })).toBeInTheDocument()
  })

  it('shows Descargar Word button', async () => {
    renderSummary()
    expect(await screen.findByRole('button', { name: /descargar word/i })).toBeInTheDocument()
  })

  it('back to patient hub link contains patient id', async () => {
    renderSummary()
    await waitFor(() => {
      const links = screen.getAllByRole('link')
      const backLink = links.find((l) => l.getAttribute('href')?.includes(mockPatient.id))
      expect(backLink).toBeTruthy()
    })
  })
})
