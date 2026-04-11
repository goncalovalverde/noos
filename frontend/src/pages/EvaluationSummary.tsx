import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, FileDown, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import { evaluationsApi, type ExecutionPlanWithResults, type TestResultItem, type TestCustomization } from '@/api/evaluations'
import type { Patient } from '@/types/patient'
import { patientsApi } from '@/api/patients'

const CLASSIFICATION_CLASSES: Record<string, string> = {
  Superior: 'bg-clinical-superior/10 text-clinical-superior border border-clinical-superior/20',
  Normal: 'bg-clinical-normal/10 text-clinical-normal border border-clinical-normal/20',
  Limítrofe: 'bg-clinical-borderline/10 text-clinical-borderline border border-clinical-borderline/20',
  Deficitario: 'bg-clinical-impaired/10 text-clinical-impaired border border-clinical-impaired/20',
}

function ClassificationBadge({ value }: { value: string }) {
  if (value === 'Sin norma validada') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Sin norma</span>
  }
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
  const [planResults, setPlanResults] = useState<ExecutionPlanWithResults | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !planId) return

    Promise.all([
      patientsApi.get(id),
      evaluationsApi.getWithResults(planId),
    ])
      .then(([p, results]) => {
        setPatient(p as Patient)
        setPlanResults(results)
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

  const sessions = planResults?.test_results ?? []
  const clinicalSessions = planResults?.clinical_sessions ?? []
  const protocolName = planResults?.protocol_name ?? null

  const radarData = sessions.map((s) => ({
    test: s.test_type,
    PE: s.calculated_scores?.puntuacion_escalar ?? 0,
    Media: 10,
  }))

  // Tests with no clinical_session_id (legacy or unassigned)
  const unassignedResults: TestResultItem[] = sessions.filter(s => !s.clinical_session_id)

  // Protocol tests not yet in results at all
  const registeredTypes = new Set(sessions.map(s => s.test_type))
  const protocolTestTypes = (planResults?.test_customizations ?? [] as TestCustomization[]).filter((t: TestCustomization) => !t.skip).map((t: TestCustomization) => t.test_type)
  const pendingTestTypes = protocolTestTypes.filter((tt: string) => !registeredTypes.has(tt))

  function fmtClinDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  }

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
              <p className="text-sm text-gray-400 mt-0.5">
                {clinicalSessions.length} sess{clinicalSessions.length !== 1 ? 'ões' : 'ão'} · {sessions.length} de {(planResults?.test_customizations ?? [] as TestCustomization[]).filter((t: TestCustomization) => !t.skip).length} testes registados
              </p>
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
      <div className="flex-1 p-8 space-y-6">

        {/* Radar chart */}
        {sessions.length > 0 && (
          <div className="rounded-card shadow-card bg-white p-6">
            <h2 className="text-base font-semibold text-[#270D38] mb-4">Perfil Cognitivo</h2>
            <div data-testid="cognitive-radar">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="test" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 19]} tick={false} />
                  <Radar name="Paciente" dataKey="PE" stroke="#9839D1" fill="#9839D1" fillOpacity={0.3} />
                  <Radar name="Media" dataKey="Media" stroke="#22c55e" fill="transparent" strokeDasharray="4 4" />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Session blocks */}
        {clinicalSessions.map(cs => {
          const csResults = sessions.filter(s => s.clinical_session_id === cs.id)
          return (
            <div key={cs.id} className="rounded-card shadow-card bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  csResults.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {csResults.length > 0 && <CheckCircle className="w-3 h-3" />}
                  Sessão {cs.session_number}
                </div>
                <span className="text-sm text-gray-500">
                  {fmtClinDate(cs.session_date)} · {csResults.length} teste{csResults.length !== 1 ? 's' : ''}
                </span>
                {cs.notes && (
                  <span className="ml-auto text-xs text-gray-400 italic truncate max-w-xs">{cs.notes}</span>
                )}
              </div>
              {csResults.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-2.5 font-semibold text-[#270D38]">Teste</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-[#270D38]">PE</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-[#270D38]">Percentil</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[#270D38]">Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csResults.map(s => {
                      const cs2 = s.calculated_scores
                      return (
                        <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-2.5 font-medium text-[#270D38]">{s.test_type}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-[#9839D1]">
                            {cs2?.puntuacion_escalar ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {cs2?.percentil != null ? Number(cs2.percentil).toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {cs2?.clasificacion
                              ? <ClassificationBadge value={cs2.clasificacion} />
                              : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="px-6 py-4 text-sm text-gray-400">Sem testes registados nesta sessão.</p>
              )}
            </div>
          )
        })}

        {/* Unassigned results (no clinical_session_id) */}
        {unassignedResults.length > 0 && (
          <div className="rounded-card shadow-card bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                Sem sessão atribuída
              </div>
              <span className="text-sm text-gray-500">{unassignedResults.length} teste{unassignedResults.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-2.5 font-semibold text-[#270D38]">Teste</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-[#270D38]">PE</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-[#270D38]">Percentil</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[#270D38]">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {unassignedResults.map(s => {
                  const sc = s.calculated_scores
                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-2.5 font-medium text-[#270D38]">{s.test_type}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-[#9839D1]">{sc?.puntuacion_escalar ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{sc?.percentil != null ? Number(sc.percentil).toFixed(1) : '—'}</td>
                      <td className="px-4 py-2.5">
                        {sc?.clasificacion ? <ClassificationBadge value={sc.clasificacion} /> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending tests block */}
        {pendingTestTypes.length > 0 && (
          <div className="rounded-card shadow-card bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-3 border-b border-yellow-100 bg-yellow-50">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                <AlertCircle className="w-3 h-3" />
                Testes por registar
              </div>
              <span className="text-sm text-gray-500">{pendingTestTypes.length} pendente{pendingTestTypes.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-2.5 font-semibold text-[#270D38]">Teste</th>
                  <th className="px-4 py-2.5 text-center text-gray-400">Score bruto</th>
                  <th className="px-4 py-2.5 text-center text-gray-400">PE</th>
                  <th className="px-4 py-2.5 text-center text-gray-400">Percentil</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {pendingTestTypes.map(tt => (
                  <tr key={tt} className="border-b border-gray-50">
                    <td className="px-6 py-2.5 text-gray-400 font-medium">{tt}</td>
                    <td className="px-4 py-2.5 text-center text-gray-300">—</td>
                    <td className="px-4 py-2.5 text-center text-gray-300">—</td>
                    <td className="px-4 py-2.5 text-center text-gray-300">—</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 italic">Pendente</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sessions.length === 0 && pendingTestTypes.length === 0 && (
          <div className="rounded-card shadow-card bg-white p-10 text-center">
            <p className="text-gray-400 text-sm">No hay resultados registrados para este plan.</p>
          </div>
        )}

        {/* Observaciones */}
        {sessions.some((s) => (s.qualitative_data as { observaciones?: string } | null)?.observaciones?.trim()) && (
          <div className="rounded-card shadow-card bg-white p-6">
            <h2 className="text-base font-semibold text-[#270D38] mb-4">Observaciones Clínicas</h2>
            <div className="space-y-3">
              {sessions
                .filter((s) => (s.qualitative_data as { observaciones?: string } | null)?.observaciones?.trim())
                .map((s) => (
                  <div key={s.id} className="text-sm text-gray-700">
                    <span className="font-semibold text-[#270D38]">{s.test_type}: </span>
                    {(s.qualitative_data as { observaciones?: string })?.observaciones}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
