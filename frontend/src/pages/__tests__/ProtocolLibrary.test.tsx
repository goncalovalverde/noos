import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { setupServer } from 'msw/node'
import { handlers, mockProtocol } from '@/test/mocks/handlers'
import ProtocolLibrary from '../ProtocolLibrary'
import { useAuthStore } from '@/store/auth'

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { role: 'Administrador', can_manage_protocols: true }, logout: vi.fn() })
  ),
}))

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProtocolLibrary', () => {
  it('shows loading state initially', () => {
    renderWithRouter(<ProtocolLibrary />)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('renders protocol list after fetch', async () => {
    renderWithRouter(<ProtocolLibrary />)
    expect(await screen.findByText(mockProtocol.name)).toBeInTheDocument()
  })

  it('shows protocol category badge', async () => {
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    const badges = screen.getAllByText(mockProtocol.category!)
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows test count for protocol', async () => {
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    expect(screen.getByText(/3\s*tests?/i)).toBeInTheDocument()
  })

  it('shows Nuevo Protocolo button when can_manage_protocols is true', async () => {
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    expect(screen.getByRole('button', { name: /nuevo protocolo/i })).toBeInTheDocument()
  })

  it('hides Nuevo Protocolo button for Observador role', async () => {
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { role: 'Observador', can_manage_protocols: false }, logout: vi.fn() } as never)
    )
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    expect(screen.queryByRole('button', { name: /nuevo protocolo/i })).not.toBeInTheDocument()
    // restore
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { role: 'Administrador', can_manage_protocols: true }, logout: vi.fn() } as never)
    )
  })

  it('opens create modal on Nuevo Protocolo button click', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    await user.click(screen.getByRole('button', { name: /nuevo protocolo/i }))
    expect(screen.getByText(/nuevo protocolo/i, { selector: 'h2,h3,[role="heading"]' })).toBeInTheDocument()
  })

  it('shows protocol detail panel on card click', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    await user.click(screen.getByText(mockProtocol.name))
    await waitFor(() => {
      const headings = screen.getAllByText(mockProtocol.name)
      expect(headings.length).toBeGreaterThan(1)
    })
  })

  it('shows delete button in detail panel when can_manage_protocols is true', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    await user.click(screen.getByText(mockProtocol.name))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument()
    })
  })

  it('shows category filter buttons', async () => {
    renderWithRouter(<ProtocolLibrary />)
    await screen.findByText(mockProtocol.name)
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument()
  })
})
