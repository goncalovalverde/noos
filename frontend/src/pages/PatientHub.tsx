import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Zap, ChevronDown, ChevronRight, ClipboardList, Calendar, FileText, FileDown, PlayCircle, Lock, UserPlus, X, History, ClipboardEdit, Save, CheckCircle2, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { patientsApi, type AccessGrant, type PatientCreate } from '@/api/patients'
import { evaluationsApi, type ExecutionPlanSummary, type ExecutionPlanWithResults } from '@/api/evaluations'
import type { Patient } from '@/types/patient'
import { usersApi, type UserOut } from '@/api/users'

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
  if (value === 'Sin norma validada') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Sin norma</span>
  }
  const cls = CLASSIFICATION_COLORS[value] ?? 'bg-gray-100 text-gray-700'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{value}</span>
}

function fmtSessionDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Expandable row: loads full results on first open, shows sessions timeline
function EvaluationRow({ plan, patientId }: { plan: ExecutionPlanSummary; patientId: string }) {
  const navigate = useNavigate()
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

  const clinicalSessions = details?.clinical_sessions ?? []
  const testResults = details?.test_results ?? []
  const nextSessionNum = clinicalSessions.length + 1

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
      </button>

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

      {/* Expanded: sessions timeline */}
      {open && (
        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-brand-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> A carregar sessões…
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sessions timeline */}
              {clinicalSessions.map((cs, idx) => {
                const sessionTests = testResults.filter(r => r.clinical_session_id === cs.id)
                const isLast = idx === clinicalSessions.length - 1
                return (
                  <div key={cs.id} className="flex gap-3">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        sessionTests.length > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {sessionTests.length > 0
                          ? <CheckCircle className="w-3.5 h-3.5" />
                          : cs.session_number}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: 16 }} />}
                    </div>

                    {/* Session card */}
                    <div className="flex-1 mb-1">
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#270D38]">Sessão {cs.session_number}</span>
                            <span className="text-xs text-gray-400">
                              {fmtSessionDate(cs.session_date)}
                              {sessionTests.length > 0 && ` · ${sessionTests.length} teste${sessionTests.length !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <button
                            onClick={() => navigate(`/patients/${patientId}/evaluate/${plan.id}`, {
                              state: {
                                sessionId: cs.id,
                                sessionNumber: cs.session_number,
                                sessionDate: cs.session_date,
                              }
                            })}
                            className="text-[11px] font-medium text-brand-mid hover:underline shrink-0"
                          >
                            Continuar
                          </button>
                        </div>
                        {sessionTests.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sessionTests.map(r => (
                              <div key={r.id} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-md px-2 py-1">
                                <span className="text-xs font-medium text-[#270D38]">{r.test_type}</span>
                                {r.calculated_scores?.puntuacion_escalar != null && (
                                  <span className="text-[10px] text-brand-mid font-semibold">
                                    PE{r.calculated_scores.puntuacion_escalar}
                                  </span>
                                )}
                                {r.calculated_scores?.clasificacion && (
                                  <ClassificationBadge value={r.calculated_scores.clasificacion} />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Sem testes registados</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Register new session row */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
                    +
                  </div>
                </div>
                <div className="flex-1">
                  <button
                    onClick={() => navigate(`/patients/${patientId}/evaluate/${plan.id}/new-session`)}
                    className="w-full flex items-center gap-3 text-left px-3 py-2.5 bg-purple-50 border border-dashed border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-brand-mid shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-brand-mid">Registar Sessão {nextSessionNum}</p>
                      <p className="text-xs text-brand-muted">Adicionar testes de uma nova visita clínica</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Summary link */}
              <div className="flex justify-end pt-1">
                <Link
                  to={`/patients/${patientId}/evaluate/${plan.id}/summary`}
                  className="text-xs font-medium text-brand-mid hover:underline"
                >
                  Ver sumário completo →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PatientHub() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [plans, setPlans] = useState<ExecutionPlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'historial' | 'datos'>('historial')

  // Access panel state
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>([])
  const [allUsers, setAllUsers] = useState<UserOut[]>([])
  const [showAccessPanel, setShowAccessPanel] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({ age: 0, education_years: 0, laterality: 'diestro', initials: '' })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canEvaluate = user?.role === 'Administrador' || user?.role === 'Neuropsicólogo'
  const isCreator = patient?.created_by_id === user?.id || user?.role === 'Administrador'

  useEffect(() => {
    if (!id) return
    Promise.all([
      patientsApi.get(id),
      evaluationsApi.listForPatient(id),
    ])
      .then(([p, ev]) => {
        setPatient(p as Patient)
        setPlans(ev as ExecutionPlanSummary[])
        setEditForm({
          age: (p as Patient).age,
          education_years: (p as Patient).education_years,
          laterality: (p as Patient).laterality,
          initials: (p as Patient).initials ?? '',
        })
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleToggleAccessPanel = async () => {
    const opening = !showAccessPanel
    setShowAccessPanel(opening)
    if (opening && accessGrants.length === 0) {
      const [grants, users] = await Promise.all([
        patientsApi.getAccess(id!),
        usersApi.list(),
      ])
      setAccessGrants(grants)
      setAllUsers(users)
    }
  }

  const handleGrantAccess = async () => {
    if (!selectedUserId || !id) return
    setAccessLoading(true)
    try {
      await patientsApi.grantAccess(id, selectedUserId)
      const grants = await patientsApi.getAccess(id)
      setAccessGrants(grants)
      setSelectedUserId('')
    } finally {
      setAccessLoading(false) }
  }

  const handleRevokeAccess = async (userId: string) => {
    if (!id) return
    await patientsApi.revokeAccess(id, userId)
    setAccessGrants(prev => prev.filter(g => g.user_id !== userId))
  }

  const handleSavePatient = async () => {
    if (!id) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await patientsApi.update(id, editForm as Partial<PatientCreate>)
      setPatient(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePatient = async () => {
    if (!id) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await patientsApi.delete(id)
      navigate('/patients')
    } catch {
      setDeleteError('Error al eliminar el paciente. Inténtalo de nuevo.')
      setDeleting(false)
    }
  }

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

  const TABS = [
    { id: 'historial', label: 'Historial de evaluaciones', icon: History },
    { id: 'datos', label: 'Datos del paciente', icon: ClipboardEdit },
  ] as const

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

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabId
                  ? 'border-brand-mid text-brand-mid'
                  : 'border-transparent text-brand-muted hover:text-brand-ink'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-8">

        {/* ── Tab 1: Historial ── */}
        {activeTab === 'historial' && (
          <section>
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
        )}

        {/* ── Tab 2: Datos del paciente ── */}
        {activeTab === 'datos' && (
          <div className="max-w-xl space-y-6">

            {/* Edit form */}
            <div className="bg-white rounded-card shadow-card border border-black/[0.06] p-6">
              <h2 className="text-base font-semibold text-brand-ink mb-5">Datos demográficos</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-ink mb-1">Edad (años)</label>
                    <input
                      type="number"
                      min={1} max={119}
                      value={editForm.age}
                      onChange={e => setEditForm(f => ({ ...f, age: Number(e.target.value) }))}
                      className="w-full bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-ink mb-1">Años de educación</label>
                    <input
                      type="number"
                      min={0} max={30}
                      value={editForm.education_years}
                      onChange={e => setEditForm(f => ({ ...f, education_years: Number(e.target.value) }))}
                      className="w-full bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">Lateralidad</label>
                  <div className="flex gap-2">
                    {(['diestro', 'zurdo', 'ambidextro'] as const).map(lat => (
                      <button
                        key={lat}
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, laterality: lat }))}
                        className={`flex-1 py-2 text-sm font-medium rounded-input border-2 transition-all capitalize ${
                          editForm.laterality === lat
                            ? 'border-brand-mid bg-brand-mid/5 text-brand-mid'
                            : 'border-gray-200 text-brand-muted hover:border-brand-mid/40'
                        }`}
                      >
                        {lat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">
                    Iniciales <span className="text-brand-muted font-normal">(opcional, máx. 4 caracteres)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editForm.initials}
                    onChange={e => setEditForm(f => ({ ...f, initials: e.target.value.toUpperCase() }))}
                    placeholder="Ej. JGM"
                    className="w-full bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
                  />
                </div>
              </div>

              {saveError && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-input px-3 py-2">{saveError}</p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleSavePatient}
                  disabled={saving}
                  className="flex items-center gap-2 bg-brand-mid hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2.5 rounded-btn transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar cambios
                </button>
                {saveSuccess && (
                  <span className="flex items-center gap-1.5 text-sm text-[#15803d]">
                    <CheckCircle2 className="w-4 h-4" /> Guardado
                  </span>
                )}
              </div>
            </div>

            {/* Access management */}
            {isCreator && (
              <div className="bg-white rounded-card shadow-card border border-black/[0.06]">
                <button
                  onClick={handleToggleAccessPanel}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-mid" />
                    <span className="text-sm font-semibold text-brand-ink">Acceso al paciente</span>
                    {accessGrants.length > 0 && (
                      <span className="text-xs text-brand-muted ml-1">{accessGrants.length} usuario{accessGrants.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {showAccessPanel ? <ChevronDown className="w-4 h-4 text-brand-muted" /> : <ChevronRight className="w-4 h-4 text-brand-muted" />}
                </button>

                {showAccessPanel && (
                  <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                    <div className="space-y-2">
                      {accessGrants.map(grant => (
                        <div key={grant.user_id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <div className="w-8 h-8 rounded-full bg-[#ede9fe] flex items-center justify-center text-xs font-semibold text-brand-mid shrink-0">
                            {(grant.full_name || grant.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-brand-ink truncate">{grant.full_name || grant.username}</p>
                            <p className="text-xs text-brand-muted">@{grant.username}</p>
                          </div>
                          {grant.is_creator ? (
                            <span className="text-[10px] font-semibold text-brand-mid bg-[#ede9fe] px-2 py-0.5 rounded-full">Creador</span>
                          ) : (
                            <button
                              onClick={() => handleRevokeAccess(grant.user_id)}
                              className="text-[#b91c1c] hover:bg-red-50 p-1.5 rounded transition-colors"
                              title="Revocar acceso"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className="flex-1 bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
                      >
                        <option value="">Añadir usuario…</option>
                        {allUsers
                          .filter(u => !accessGrants.find(g => g.user_id === u.id))
                          .map(u => (
                            <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                          ))
                        }
                      </select>
                      <button
                        onClick={handleGrantAccess}
                        disabled={!selectedUserId || accessLoading}
                        className="flex items-center gap-1 bg-brand-mid text-white px-3 py-2 rounded-btn text-sm font-semibold disabled:opacity-40 hover:bg-brand-dark transition-colors whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Añadir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delete patient — only for creator */}
            {isCreator && (
              <div className="bg-white rounded-card shadow-card border border-red-100 p-6">
                <h2 className="text-base font-semibold text-red-700 mb-1">Zona de peligro</h2>
                <p className="text-sm text-brand-muted mb-4">
                  Eliminar el paciente borrará permanentemente todos sus datos, evaluaciones y registros de la plataforma. Esta acción no se puede deshacer.
                </p>
                <button
                  onClick={() => { setShowDeleteModal(true); setDeleteError(null) }}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-btn transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar paciente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card shadow-xl border border-gray-200 w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-brand-ink mb-1">
                    ¿Eliminar paciente {patient?.display_id}?
                  </h2>
                  <p className="text-sm text-brand-muted">Esta acción es permanente e irreversible.</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-input px-4 py-3 mb-5 space-y-1.5">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Se eliminará permanentemente:</p>
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Todos los datos demográficos del paciente
                </div>
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {plans.length} evaluaci{plans.length !== 1 ? 'ones' : 'ón'} (activas, en borrador y completadas)
                </div>
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Todos los resultados de tests neuropsicológicos
                </div>
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Permisos de acceso concedidos a otros usuarios
                </div>
              </div>

              {deleteError && (
                <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-input px-3 py-2">{deleteError}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-semibold text-brand-ink border border-gray-200 rounded-btn hover:bg-brand-bg transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePatient}
                  disabled={deleting}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-btn transition-colors disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Eliminando…' : 'Sí, eliminar paciente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
