import { LayoutDashboard } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard className="w-6 h-6 text-brand-mid" />
        <h1 className="text-2xl font-semibold text-brand-ink">Overview</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Pacientes activos', 'Evaluaciones este mes', 'Tests realizados'].map((label) => (
          <div key={label} className="bg-white rounded-card shadow-card p-5">
            <p className="text-sm text-brand-muted">{label}</p>
            <p className="text-3xl font-semibold text-brand-dark mt-1">—</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-brand-muted text-sm">Dashboard en construcción…</p>
    </div>
  )
}
