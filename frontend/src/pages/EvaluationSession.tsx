import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { X, Loader2, CheckCircle2, Calendar } from 'lucide-react'
import { evaluationsApi, type TestCustomization } from '@/api/evaluations'
import { clinicalSessionsApi, type ClinicalSession } from '@/api/clinicalSessions'
import { testsApi } from '@/api/tests'
import { patientsApi } from '@/api/patients'
import type { Patient } from '@/types/patient'
import TestFormDispatcher from '@/components/evaluation/TestFormDispatcher'

const CLASSIFICATION_COLORS: Record<string, string> = {
  'Superior':   'text-[#15803d]',
  'Normal':     'text-[#1d4ed8]',
  'Limítrofe':  'text-[#a16207]',
  'Deficitario':'text-[#b91c1c]',
}

export default function EvaluationSession() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Session context — passed from EvaluationSetup, or loaded from API on refresh
  const navState = location.state as { sessionId?: string; sessionNumber?: number; sessionDate?: string } | null
  const [session, setSession] = useState<ClinicalSession | null>(
    navState?.sessionId
      ? { id: navState.sessionId, execution_plan_id: planId ?? '', session_number: navState.sessionNumber ?? 1, session_date: navState.sessionDate ?? '', notes: null, created_at: '' }
      : null
  )

  const [_patient, setPatient] = useState<Patient | null>(null)
  const [tests, setTests] = useState<TestCustomization[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [allowCustomization, setAllowCustomization] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedScore, setSavedScore] = useState<{
    pe: number | null; percentil: number | null; clasificacion: string; testType: string; noNorm?: boolean
  } | null>(null)

  useEffect(() => {
    if (!patientId || !planId) return
    Promise.all([
      patientsApi.get(patientId),
      evaluationsApi.get(planId),
      evaluationsApi.getWithResults(planId),
    ]).then(([_p, plan, results]) => {
      setPatient(_p)
      setAllowCustomization(plan.allow_customization ?? true)
      const activTests = plan.test_customizations.filter(t => !t.skip)
      setTests(activTests)
      // Resume: start at first test not yet saved
      const doneTypes = new Set(results.test_results.map(r => r.test_type))
      const firstPending = activTests.findIndex(t => !doneTypes.has(t.test_type))
      setCurrentIdx(firstPending >= 0 ? firstPending : 0)
    }).finally(() => setLoading(false))
  }, [patientId, planId])

  // If session wasn't passed via nav state (e.g. page refresh), load the most recent session
  useEffect(() => {
    if (session || !planId) return
    clinicalSessionsApi.list(planId).then(sessions => {
      if (sessions.length > 0) {
        setSession(sessions[sessions.length - 1])
      }
    }).catch(() => { /* no sessions yet — session stays null */ })
  }, [planId, session])

  const currentTest = tests[currentIdx]
  const isLast = currentIdx >= tests.length - 1

  const advance = useCallback(() => {
    setSavedScore(null)
    if (isLast) {
      navigate(`/patients/${patientId}/evaluate/${planId}/summary`)
    } else {
      setCurrentIdx(i => i + 1)
    }
  }, [isLast, patientId, planId, navigate])

  const handleSave = async (rawData: Record<string, unknown>, qualitativeData?: Record<string, unknown>) => {
    if (!patientId || !planId || !currentTest) return
    setSaving(true)
    try {
      const result = await testsApi.create({
        patient_id: patientId,
        execution_plan_id: planId,
        test_type: currentTest.test_type,
        clinical_session_id: session?.id,
        raw_data: rawData,
        qualitative_data: qualitativeData,
      })
      const scores = result.calculated_scores
      if (scores) {
        const noNorm = scores.norma_aplicada?.fuente === 'Sin tabla normativa'
        setSavedScore({
          pe: scores.puntuacion_escalar ?? null,
          percentil: scores.percentil ?? null,
          clasificacion: scores.clasificacion ?? '',
          testType: currentTest.test_type,
          noNorm,
        })
      } else {
        advance()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (!planId || !currentTest) return
    const updated = tests.map((t, i) => i === currentIdx ? { ...t, skip: true } : t)
    await evaluationsApi.update(planId, { test_customizations: updated })
    advance()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen gap-2 text-brand-muted">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Cargando…</span>
    </div>
  )

  if (!currentTest) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-brand-muted">No hay tests pendientes.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Minimal sticky header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {session && (
              <span className="flex items-center gap-1 text-xs font-medium text-brand-mid bg-purple-50 border border-purple-100 rounded-full px-2.5 py-1 shrink-0">
                <Calendar className="w-3 h-3" />
                Sessão {session.session_number}
                {session.session_date && (
                  <span className="text-brand-muted ml-1">
                    {new Date(session.session_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
              </span>
            )}
            <span className="text-sm text-brand-muted">
              Test {currentIdx + 1} de {tests.length} — {currentTest.test_type}
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-mid rounded-full transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / tests.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => navigate(`/patients/${patientId}`)}
            className="text-brand-muted hover:text-brand-ink shrink-0"
            aria-label="Cerrar evaluación"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
      {/* Test form */}
        <TestFormDispatcher
          testType={currentTest.test_type}
          mode="paper"
          onSave={handleSave}
          onSkip={allowCustomization ? handleSkip : undefined}
          saving={saving}
        />
      </main>

      {/* Results modal */}
      {savedScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[16px] shadow-xl w-full max-w-sm mx-4 p-8 flex flex-col items-center text-center">
            <CheckCircle2 className="w-14 h-14 text-[#15803d] mb-4" />
            <h2 className="text-lg font-semibold text-brand-ink mb-1">{savedScore.testType} guardado</h2>
            <p className="text-brand-muted text-sm mb-6">Resultado de la evaluación</p>

            <div className="w-full grid grid-cols-3 gap-3 mb-6">
              <div className="bg-brand-bg rounded-xl p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.7px] text-brand-muted mb-1">PE</p>
                <p className="text-2xl font-semibold text-brand-ink">{savedScore.pe ?? '—'}</p>
              </div>
              <div className="bg-brand-bg rounded-xl p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.7px] text-brand-muted mb-1">Percentil</p>
                <p className="text-2xl font-semibold text-brand-ink">
                  {savedScore.percentil != null ? savedScore.percentil.toFixed(0) : '—'}
                </p>
              </div>
              <div className="bg-brand-bg rounded-xl p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.7px] text-brand-muted mb-1">Clasif.</p>
                {savedScore.clasificacion === 'Sin norma validada'
                  ? <p className="text-base font-semibold text-gray-400">Sin norma</p>
                  : <p className={`text-base font-semibold ${CLASSIFICATION_COLORS[savedScore.clasificacion] ?? 'text-brand-ink'}`}>
                      {savedScore.clasificacion}
                    </p>
                }
              </div>
            </div>
            {savedScore.noNorm && (
              <p className="text-xs text-gray-400 mb-6 text-center">
                Sin tablas normativas validadas para este test
              </p>
            )}

            <button
              onClick={advance}
              className="w-full bg-brand-mid hover:bg-brand-dark text-white font-medium py-2.5 rounded-btn transition-colors"
            >
              {isLast ? 'Ver resumen' : 'Siguiente test'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
