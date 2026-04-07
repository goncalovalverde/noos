import { NavLink, useNavigate } from 'react-router-dom'
import { Brain, LayoutDashboard, Users, ClipboardList, Settings, LogOut, Menu, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/patients', icon: Users, label: 'Pacientes' },
  { to: '/protocols', icon: ClipboardList, label: 'Protocolos' },
]

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '??'

  const roleColor: Record<string, string> = {
    'Administrador': 'bg-brand-accent text-white',
    'Neuropsicólogo': 'bg-purple-300 text-brand-ink',
    'Observador': 'bg-gray-300 text-gray-700',
  }

  return (
    <aside
      className="flex flex-col h-screen bg-brand-dark text-white transition-all duration-200 shrink-0"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">Nóos</span>
        )}
        <button
          onClick={onToggle}
          className={`ml-auto text-white/60 hover:text-white transition-colors ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-mid text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {user?.role === 'Administrador' && (
          <>
            <div className="my-2 border-t border-white/10" />
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-mid text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
              title={collapsed ? 'Configuración' : undefined}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Configuración</span>}
            </NavLink>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-brand-mid flex items-center justify-center text-sm font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || user?.username}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColor[user?.role ?? ''] ?? 'bg-gray-500 text-white'}`}>
                {user?.role}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={handleLogout}
            className="mt-2 w-full flex justify-center text-white/60 hover:text-white transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
