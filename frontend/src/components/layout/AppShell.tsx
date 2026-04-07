import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

// Routes that hide the sidebar completely (fullscreen mode)
const FULLSCREEN_ROUTES = ['/evaluate']

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const isFullscreen = FULLSCREEN_ROUTES.some(r => location.pathname.includes(r))

  if (isFullscreen) {
    return <Outlet />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
