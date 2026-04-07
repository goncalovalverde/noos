import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import type { ReactNode } from 'react'

interface Props {
  allowedRoles?: string[]
  children?: ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
