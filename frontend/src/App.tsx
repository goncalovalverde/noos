import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import PatientList from '@/pages/PatientList'
import PatientHub from '@/pages/PatientHub'
import ProtocolLibrary from '@/pages/ProtocolLibrary'
import Settings from '@/pages/Settings'
import EvaluationSetup from '@/pages/EvaluationSetup'
import EvaluationSession from '@/pages/EvaluationSession'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — wrapped in AppShell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:id" element={<PatientHub />} />
          <Route path="/patients/:id/evaluate" element={<EvaluationSetup />} />
          <Route path="/patients/:id/evaluate/:planId" element={<EvaluationSession />} />
          <Route path="/protocols" element={<ProtocolLibrary />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['Administrador']}>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}


