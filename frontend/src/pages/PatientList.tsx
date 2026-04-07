import { Users, Plus } from 'lucide-react'

export default function PatientList() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-brand-mid" />
          <h1 className="text-2xl font-semibold text-brand-ink">Pacientes</h1>
        </div>
        <button className="flex items-center gap-2 bg-brand-mid text-white text-sm font-medium px-4 py-2 rounded-btn hover:bg-brand-dark transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo paciente
        </button>
      </div>
      <div className="bg-white rounded-card shadow-card p-6">
        <p className="text-brand-muted text-sm">Lista de pacientes en construcción…</p>
      </div>
    </div>
  )
}
