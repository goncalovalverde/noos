import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Zap, ChevronDown, ChevronRight, ClipboardList, Calendar, FileText, FileDown, PlayCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { patientsApi } from '@/api/patients'
import { evaluationsApi, type ExecutionPlanSummary, type ExecutionPlanWithResults } from '@/api/evaluations'
import type { Patient } from '@/types/patient'

const CLASSIFICATION_COLORS: Record<string, string> = {
  Superior: 'bg-green-100 text-green-800',
  Normal: 'bg-blue-100 text-blue-800',
  Limítrofe: 'bg-yellow-100 text-yellow-800',
  Deficitario: 'bg-red-100 text-red-800',
}
const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  active: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  abandoned: 'bg-red-100 text-red-600',
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completado', active: 'En curso', draft: 'Borrador', abandoned: 'Abandonado',
}

function ClassificationBadge({ value }: { value: string }) {
  const cls = CLASSIFICATION_COLORS[value] ?? 'bg-gray-100 text-gray-700'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{value}</span>
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Expandable row: loads full results on first open
function EvaluationRow({ plan, patientId }: { plan: ExecutionPlanSummary; patientId: string }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<ExecutionPlanWithResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<'pdf' | 'word' | null>(null)

  const toggle = async () => {
    if (!open && !details) {
      setLoading(true)
      try {
        const d = await evaluationsApi.getWithResults(plan.id)
        setDetails(d)
      } finally {
        setLoading(false)
      }
    }
    setOpen(o => !o)
  }

  const handleDownload = async (e: React.MouseEvent, format: 'pdf' | 'word') => {
    e.stopPropagation()
    setDownloading(format)
    const slug = (plan.protocol_name ?? 'informe').replace(/\s+/g, '_').toLowerCase()
    const ext = format === 'pdf' ? 'pdf' : 'docx'
    try {
      await evaluationsApi.downloadReport(plan.id, format, `${slug}_${plan.id.slice(0, 6)}.${ext}`)
    } finally {
      setDownloading(null)
    }
  }

  const datesAreSame = plan.performed_at && plan.created_at &&
    fmtDate(plan.performed_at) === fmtDate(plan.created_at)

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Summary row */}
      <button
        onClick={toggle}
        className="w-full text-left flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="text-gray-400 flex-shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <ClipboardList className="w-4 h-4 text-brand-mid flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-brand-ink text-sm">
              {plan.protocol_name ?? 'Protocolo eliminado'}
            </span>
            {plan.protocol_category && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                {plan.protocol_category}
              </span>
            )}
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[plan.status] ?? plan.status}
            </span>
            {plan.mode === 'paper' && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Diferido
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Realizado: <strong className="text-gray-600 ml-1">{fmtDate(plan.performed_at)}</strong>
            </span>
            {!datesAreSame && plan.mode === 'paper' && (
              <span className="flex items-center gap-1">
                Introducido: <strong className="text-gray-600 ml-1">{fmtDate(plan.created_at)}</strong>
              </span>
            )}
            <span>{plan.test_count}/{plan.total_tests} tests</span>
          </div>
        </div>

        {/* Export buttons — outside the toggle button to avoid nested buttons */}
      </button>
      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity" />

      {/* Action buttons row */}
      <div className="flex items-center gap-1.5 px-5 pb-3 -mt-1">
        {plan.status === 'active' && (
          <Link
            to={`/patients/${patientId}/evaluate/${plan.id}`}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded border border-brand-mid text-brand-mid hover:bg-brand-mid hover:text-white transition-colors"
            title="Continuar evaluación en curso"
          >
            <PlayCircle className="w-3 h-3" />
            Continuar evaluación
          </Link>
        )}
        <button
          onClick={e => handleDownload(e, 'pdf')}
          disabled={downloading !== null}
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Exportar PDF"
        >
          {downloading === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
          PDF
        </button>
        <button
          onClick={e => handleDownload(e, 'word')}
          disabled={downloading !== null}
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
          title="Exportar Word"
        >
          {downloading === 'word' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
          Word
        </button>
      </div>

      {/* Expanded: test results */}
      {open && (
        <div className="px-5 pb-4">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-brand-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando resultados…
            </div>
          ) : details && details.test_results.length > 0 ? (
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-semibold text-brand-ink">Test</th>
                  <th className="text-center px-4 py-2 font-semibold text-brand-ink">PE</th>
                  <th className="text-center px-4 py-2 font-semibold text-brand-ink">Percentil</th>
                  <th className="text-left px-4 py-2 font-semibold text-brand-ink">Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {details.test_results.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-brand-ink">{r.test_type}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-brand-mid">
                      {r.calculated_scores?.puntuacion_escalar ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600">
                      {r.calculated_scores?.percentil != null ? `P${r.calculated_scores.percentil}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.calculated_scores?.clasificacion
                        ? <ClassificationBadge value={r.calculated_scores.clasificacion} />
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 py-2">Sin resultados registrados aún.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PatientHub() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [plans, setPlans] = useState<ExecutionPlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const canEvaluate = user?.role === 'Administrador' || user?.role === 'Neuropsicólogo'

  useEffect(() => {
    if (!id) return
    Promise.all([
      patientsApi.get(id),
      evaluationsApi.listForPatient(id),
    ])
      .then(([p, ev]) => {
        setPatient(p as Patient)
        setPlans(ev as ExecutionPlanSummary[])
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
        {/* Evaluation History */}
        <section>
          <h2 className="text-base font-semibold text-[#270D38] mb-4">Historial de Evaluaciones</h2>
          {plans.length === 0 ? (
            <div className="rounded-card shadow-card bg-white p-10 text-center">
              <p className="text-gray-400 text-sm">Sin evaluaciones aún</p>
              {canEvaluate && (
                <Link
                  to={`/patients/${id}/evaluate`}
                  className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand-mid hover:underline font-medium"
                >
                  <Plus size={14} /> Nueva Evaluación
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-card shadow-card bg-white overflow-hidden divide-y divide-gray-100">
              {plans.map(plan => (
                <EvaluationRow key={plan.id} plan={plan} patientId={id!} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
