import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { patientsApi } from '@/api/patients'
import type { Patient, TestSessionOut } from '@/types/patient'

const CLASSIFICATION_COLORS: Record<string, string> = {
  Superior: 'bg-green-100 text-green-800',
  Normal: 'bg-blue-100 text-blue-800',
  Limítrofe: 'bg-yellow-100 text-yellow-800',
  Deficitario: 'bg-red-100 text-red-800',
}

function ClassificationBadge({ value }: { value: string }) {
  const cls = CLASSIFICATION_COLORS[value] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {value}
    </span>
  )
}

export default function PatientHub() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<TestSessionOut[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const canEvaluate = user?.role === 'Administrador' || user?.role === 'Neuropsicólogo'

  useEffect(() => {
    if (!id) return
    Promise.all([
      patientsApi.get(id),
      patientsApi.getSessions(id),
    ])
      .then(([p, s]) => {
        setPatient(p as Patient)
        setSessions(s as TestSessionOut[])
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[#9839D1]">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-base font-medium">Cargando</span>
      </div>
    )
  }

  if (notFound || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-lg font-semibold text-[#270D38]">Paciente no encontrado</p>
        <Link to="/patients" aria-label="Pacientes" className="text-[#9839D1] hover:underline text-sm">
          ← Volver a Pacientes
        </Link>
      </div>
    )
  }

  const initials = patient.initials ?? patient.display_id.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.07] px-8">
        <div className="flex items-center gap-4 py-5 pb-4">
          <Link
            to="/patients"
            aria-label="Pacientes"
            className="flex items-center gap-1.5 text-sm text-[#9839D1] font-medium px-2.5 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <ArrowLeft size={15} />
            Pacientes
          </Link>

          <div className="flex items-center gap-4 flex-1">
            <div
              className="w-13 h-13 rounded-full flex items-center justify-center text-lg font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #9839D1, #B738F2)', width: 52, height: 52 }}
            >
              {initials}
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#270D38]">{patient.display_id}</h1>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                  {patient.age} años
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {patient.education_years} años edu.
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {patient.laterality}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 ml-auto">
            {canEvaluate && (
              <Link
                to={`/patients/${id}/evaluate`}
                aria-label="Nueva Evaluación"
                className="inline-flex items-center gap-1.5 bg-[#9839D1] hover:bg-[#4B164F] text-white rounded-btn px-5 py-2.5 text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Nueva Evaluación
              </Link>
            )}
            <button className="inline-flex items-center gap-1.5 border border-[#9839D1] text-[#9839D1] hover:bg-purple-50 rounded-btn px-4 py-2 text-sm font-medium transition-colors">
              <Zap size={14} />
              Test Rápido
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 space-y-8">
        {/* Evaluation History + Cognitive Profile (unified) */}
        <section>
          <h2 className="text-base font-semibold text-[#270D38] mb-4">Historial de Evaluaciones</h2>
          {sessions.length === 0 ? (
            <div className="rounded-card shadow-card bg-white p-10 text-center">
              <p className="text-gray-400 text-sm">Sin evaluaciones aún</p>
            </div>
          ) : (
            <div className="rounded-card shadow-card bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-semibold text-[#270D38]">Test</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#270D38]">Fecha</th>
                    <th className="text-center px-5 py-3 font-semibold text-[#270D38]">PE</th>
                    <th className="text-center px-5 py-3 font-semibold text-[#270D38]">Percentil</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#270D38]">Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const scores = s.calculated_scores
                    return (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-[#270D38]">{s.test_type}</td>
                        <td className="px-5 py-3 text-gray-500">
                          {new Date(s.date).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-5 py-3 text-center font-semibold text-[#9839D1]">
                          {scores?.puntuacion_escalar ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600">
                          {scores?.percentil != null ? `${scores.percentil}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {scores?.clasificacion ? (
                            <ClassificationBadge value={scores.clasificacion} />
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
