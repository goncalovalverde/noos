import { Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<div className="p-8 text-brand-ink font-sans"><h1 className="text-2xl font-semibold text-brand-dark">Nóos — en construcción</h1></div>} />
    </Routes>
  )
}

export default App
