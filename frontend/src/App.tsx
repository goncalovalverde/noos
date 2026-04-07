import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import Login from '@/pages/Login'

// Placeholder pages until implemented
const Dashboard = () => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold text-brand-dark">Dashboard</h1>
    <p className="text-brand-muted mt-2">En construcción…</p>
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

