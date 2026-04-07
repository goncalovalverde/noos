import { Users, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { patientsApi, type PatientCreate } from '@/api/patients'
import type { Patient } from '@/types/patient'
import PatientForm from '@/components/patient/PatientForm'

export default function PatientList() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const canCreate = user?.role === 'Administrador' || user?.role === 'Neuropsicólogo'

  useEffect(() => {
    patientsApi.list()
      .then(setPatients)
      .catch(() => setError('Error al cargar los pacientes'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = patients.filter(p =>
    p.display_id.toLowerCase().includes(search.toLowerCase()) ||
    (p.initials && p.initials.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async (data: PatientCreate) => {
    const created = await patientsApi.create(data)
    setPatients(prev => [created, ...prev])
    setShowForm(false)
  }

  const lateralityLabel: Record<string, string> = {
    diestro: 'Diestro', zurdo: 'Zurdo', ambidextro: 'Ambidextro'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-brand-mid" />
          <h1 className="text-2xl font-semibold text-brand-ink">Pacientes</h1>
          {!loading && (
            <span className="text-sm text-brand-muted bg-white border border-gray-200 px-2 py-0.5 rounded-full">
              {patients.length}
            </span>
          )}
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-brand-mid text-white text-sm font-medium px-4 py-2 rounded-btn hover:bg-brand-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo paciente
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input
          type="text"
          placeholder="Buscar por iniciales o ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
        />
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-brand-muted gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-card text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-brand-muted">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {search ? 'Sin resultados para esa búsqueda' : 'No hay pacientes registrados'}
          </p>
          {!search && canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-brand-mid text-sm hover:underline"
            >
              Crear el primer paciente
            </button>
          )}
        </div>
      )}

      {/* Patient list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          {filtered.map((patient, idx) => (
            <button
              key={patient.id}
              onClick={() => navigate(`/patients/${patient.id}`)}
              className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-brand-bg transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-brand-dark text-white flex items-center justify-center text-sm font-semibold shrink-0">
                {patient.initials ?? patient.display_id.slice(0, 2)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-brand-ink">{patient.display_id}</p>
                <p className="text-sm text-brand-muted">
                  {patient.age} años · {patient.education_years} años de educación · {lateralityLabel[patient.laterality]}
                </p>
              </div>

              {/* Date */}
              <div className="text-right shrink-0">
                <p className="text-xs text-brand-muted">
                  {new Date(patient.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-brand-muted shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <PatientForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
