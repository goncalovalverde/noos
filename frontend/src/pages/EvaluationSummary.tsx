import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, FileDown, FileText } from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import { patientsApi } from '@/api/patients'
import { evaluationsApi } from '@/api/evaluations'
import { protocolsApi } from '@/api/protocols'
import type { Patient } from '@/types/patient'

interface CalculatedScores {
  puntuacion_escalar?: number
  percentil?: number
  z_score?: number
  clasificacion?: string
  norma_aplicada?: Record<string, string>
}

interface SessionOut {
  id: string
  test_type: string
  date: string
  calculated_scores?: CalculatedScores | null
  raw_data?: Record<string, unknown>
  qualitative_data?: { observaciones?: string }
  execution_plan_id?: string | null
}

const CLASSIFICATION_CLASSES: Record<string, string> = {
  Superior: 'bg-clinical-superior/10 text-clinical-superior border border-clinical-superior/20',
  Normal: 'bg-clinical-normal/10 text-clinical-normal border border-clinical-normal/20',
  Limítrofe: 'bg-clinical-borderline/10 text-clinical-borderline border border-clinical-borderline/20',
  Deficitario: 'bg-clinical-impaired/10 text-clinical-impaired border border-clinical-impaired/20',
}

function ClassificationBadge({ value }: { value: string }) {
  const cls = CLASSIFICATION_CLASSES[value] ?? 'bg-gray-100 text-gray-700 border border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value}
    </span>
  )
}

export default function EvaluationSummary() {
  const { id, planId } = useParams<{ id: string; planId: string }>()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<SessionOut[]>([])
  const [protocolName, setProtocolName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !planId) return

    Promise.all([
      patientsApi.get(id),
      patientsApi.getSessions(id),
      evaluationsApi.get(planId),
    ])
      .then(async ([p, allSessions, plan]) => {
        setPatient(p as Patient)
        const planSessions = (allSessions as SessionOut[]).filter(
          (s) => s.execution_plan_id === planId
        )
        setSessions(planSessions)
        if (plan.protocol_id) {
          try {
            const proto = await protocolsApi.get(plan.protocol_id)
            setProtocolName(proto.name)
          } catch {
            // protocol name is optional
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, planId])

  const [downloading, setDownloading] = useState<'pdf' | 'word' | null>(null)

  const downloadReport = async (format: 'pdf' | 'word') => {
    if (!planId) return
    setDownloading(format)
    const ext = format === 'pdf' ? 'pdf' : 'docx'
    try {
      await evaluationsApi.downloadReport(planId, format, `informe_${planId.slice(0, 6)}.${ext}`)
    } finally {
      setDownloading(null)
    }
  }

  const radarData = sessions.map((s) => ({
    test: s.test_type,
    PE: s.calculated_scores?.puntuacion_escalar ?? 0,
    Media: 10,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[#9839D1]">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-base font-medium">Cargando</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.07] px-8">
        <div className="flex items-center gap-4 py-5 pb-4">
          <Link
            to={`/patients/${id}`}
            className="flex items-center gap-1.5 text-sm text-[#9839D1] font-medium px-2.5 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <ArrowLeft size={15} />
            Volver al paciente
          </Link>

          <div className="flex items-center gap-3 flex-1">
            <div>
              <h1 className="text-[22px] font-semibold text-[#270D38]">
                {patient?.display_id ?? '—'}
              </h1>
              {protocolName && (
                <p className="text-sm text-gray-500 mt-0.5">{protocolName}</p>
              )}
              <p className="text-sm text-gray-400 mt-0.5">Plan de evaluación</p>
            </div>
          </div>

          <div className="flex gap-2.5 ml-auto">
            <button
              onClick={() => downloadReport('pdf')}
              disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 border border-[#9839D1] text-[#9839D1] hover:bg-purple-50 rounded-btn px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {downloading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Descargar PDF
            </button>
            <button
              onClick={() => downloadReport('word')}
              disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 border border-[#9839D1] text-[#9839D1] hover:bg-purple-50 rounded-btn px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {downloading === 'word' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Descargar Word
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
        {sessions.length === 0 ? (
          <div className="rounded-card shadow-card bg-white p-10 text-center">
            <p className="text-gray-400 text-sm">No hay resultados registrados para este plan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <div className="rounded-card shadow-card bg-white p-6">
              <h2 className="text-base font-semibold text-[#270D38] mb-4">Perfil Cognitivo</h2>
              <div data-testid="cognitive-radar">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="test" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 19]} tick={false} />
                    <Radar
                      name="Paciente"
                      dataKey="PE"
                      stroke="#9839D1"
                      fill="#9839D1"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Media"
                      dataKey="Media"
                      stroke="#22c55e"
                      fill="transparent"
                      strokeDasharray="4 4"
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-card shadow-card bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-[#270D38]">Resultados de las Pruebas</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-semibold text-[#270D38]">Prueba</th>
                    <th className="text-center px-4 py-3 font-semibold text-[#270D38]">PE</th>
                    <th className="text-center px-4 py-3 font-semibold text-[#270D38]">Percentil</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#270D38]">Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const cs = s.calculated_scores
                    return (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-[#270D38]">{s.test_type}</td>
                        <td className="px-4 py-3 text-center font-semibold text-[#9839D1]">
                          {cs?.puntuacion_escalar ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {cs?.percentil != null
                            ? Number(cs.percentil).toFixed(1)
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {cs?.clasificacion ? (
                            <ClassificationBadge value={cs.clasificacion} />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Observaciones */}
        {sessions.some((s) => s.qualitative_data?.observaciones?.trim()) && (
          <div className="rounded-card shadow-card bg-white p-6 mt-6">
            <h2 className="text-base font-semibold text-[#270D38] mb-4">Observaciones Clínicas</h2>
            <div className="space-y-3">
              {sessions
                .filter((s) => s.qualitative_data?.observaciones?.trim())
                .map((s) => (
                  <div key={s.id} className="text-sm text-gray-700">
                    <span className="font-semibold text-[#270D38]">{s.test_type}: </span>
                    {s.qualitative_data?.observaciones}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
