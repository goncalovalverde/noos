import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers, mockUser } from '@/test/mocks/handlers'
import Settings from '../Settings'

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: { id: 'admin-id', role: 'Administrador', can_manage_protocols: true },
      logout: vi.fn(),
    })
  ),
}))

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Settings', () => {
  it('shows loading state initially', () => {
    renderWithRouter(<Settings />)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('renders user list after fetch', async () => {
    renderWithRouter(<Settings />)
    expect(await screen.findByText(mockUser.full_name!)).toBeInTheDocument()
  })

  it('shows role badge', async () => {
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    expect(screen.getByText('Neuropsicólogo')).toBeInTheDocument()
  })

  it('shows active indicator for active user', async () => {
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    expect(screen.getByText(/activo/i)).toBeInTheDocument()
  })

  it('shows Nuevo Usuario button for Administrador', async () => {
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    expect(screen.getByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument()
  })

  it('opens create user modal on Nuevo Usuario click', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    await user.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    expect(screen.getByRole('heading', { name: /nuevo usuario/i })).toBeInTheDocument()
  })

  it('create modal has role selector', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    await user.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    expect(screen.getByRole('combobox', { name: /rol/i })).toBeInTheDocument()
  })

  it('create modal has can_manage_protocols toggle', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    await user.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    expect(
      screen.getByRole('checkbox', { name: /gestión.*protocolos|protocolos/i })
    ).toBeInTheDocument()
  })

  it('shows edit button per user row', async () => {
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
  })

  it('shows delete button per user row', async () => {
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument()
  })

  it('can toggle can_manage_protocols inline and calls PATCH', async () => {
    const user = userEvent.setup()
    let patchCalled = false
    server.use(
      http.patch('/api/users/:id', async ({ request }) => {
        patchCalled = true
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json({ ...mockUser, ...body })
      })
    )
    renderWithRouter(<Settings />)
    await screen.findByText(mockUser.full_name!)
    const toggleBtn = screen.getByRole('button', { name: /gestión protocolos/i })
    await user.click(toggleBtn)
    await waitFor(() => expect(patchCalled).toBe(true))
  })
})
