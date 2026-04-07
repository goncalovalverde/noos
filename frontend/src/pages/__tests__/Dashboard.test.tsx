import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setupServer } from 'msw/node'
import { handlers, mockOverviewStats, mockRecentPlan } from '@/test/mocks/handlers'
import Dashboard from '@/pages/Dashboard'

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: {
        id: 'admin-id',
        username: 'admin',
        full_name: 'Dra. García',
        role: 'Administrador',
        can_manage_protocols: true,
      },
      logout: vi.fn(),
    })
  ),
}))

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  it('shows loading state initially', () => {
    renderDashboard()
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('shows greeting with user name after loading', async () => {
    renderDashboard()
    expect(await screen.findByText(/Dra\. García/i)).toBeInTheDocument()
  })

  it('shows today\'s date', async () => {
    renderDashboard()
    const year = new Date().getFullYear().toString()
    await waitFor(() => expect(screen.getByText(new RegExp(year))).toBeInTheDocument())
  })

  it('shows total_patients stat card', async () => {
    renderDashboard()
    expect(await screen.findByText(mockOverviewStats.total_patients.toString())).toBeInTheDocument()
  })

  it('shows tests_this_week stat card', async () => {
    renderDashboard()
    expect(await screen.findByText(mockOverviewStats.tests_this_week.toString())).toBeInTheDocument()
  })

  it('shows active_protocols stat card', async () => {
    renderDashboard()
    expect(await screen.findByText(mockOverviewStats.active_protocols.toString())).toBeInTheDocument()
  })

  it('shows completed_this_month stat card', async () => {
    renderDashboard()
    expect(await screen.findByText(mockOverviewStats.completed_this_month.toString())).toBeInTheDocument()
  })

  it('shows recent evaluations section heading', async () => {
    renderDashboard()
    expect(await screen.findByText(/evaluaciones recientes/i)).toBeInTheDocument()
  })

  it('shows recent plan patient_display_id', async () => {
    renderDashboard()
    expect(await screen.findByText(mockRecentPlan.patient_display_id)).toBeInTheDocument()
  })

  it('shows recent plan protocol_name', async () => {
    renderDashboard()
    expect(await screen.findByText(mockRecentPlan.protocol_name)).toBeInTheDocument()
  })

  it('shows status badge for completed plan', async () => {
    renderDashboard()
    expect(await screen.findByText(/completado|completed/i)).toBeInTheDocument()
  })

  it('shows classification distribution chart', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('classification-chart')).toBeInTheDocument()
    )
  })
})
