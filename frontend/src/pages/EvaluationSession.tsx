import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Loader2 } from 'lucide-react'
import { evaluationsApi, type TestCustomization } from '@/api/evaluations'
import { testsApi } from '@/api/tests'
import { patientsApi } from '@/api/patients'
import type { Patient } from '@/types/patient'
import TestFormDispatcher from '@/components/evaluation/TestFormDispatcher'
import SessionTimer from '@/components/evaluation/SessionTimer'

export default function EvaluationSession() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [tests, setTests] = useState<TestCustomization[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [mode, setMode] = useState<string>('live')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedScore, setSavedScore] = useState<{
    pe: number; percentil: number; clasificacion: string
  } | null>(null)

  useEffect(() => {
    if (!patientId || !planId) return
    Promise.all([
      patientsApi.get(patientId),
      evaluationsApi.get(planId),
    ]).then(([p, plan]) => {
      setPatient(p)
      setMode(plan.mode)
      setTests(plan.test_customizations.filter(t => !t.skip))
    }).finally(() => setLoading(false))
  }, [patientId, planId])

  const currentTest = tests[currentIdx]
  const isLast = currentIdx >= tests.length - 1

  const advance = useCallback(() => {
    if (isLast) {
      navigate(`/patients/${patientId}/evaluate/${planId}/summary`)
    } else {
      setSavedScore(null)
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
        raw_data: rawData,
        qualitative_data: qualitativeData,
      })
      const scores = result.calculated_scores
      if (scores?.puntuacion_escalar) {
        setSavedScore({
          pe: scores.puntuacion_escalar,
          percentil: scores.percentil ?? 0,
          clasificacion: scores.clasificacion ?? '',
        })
        setTimeout(advance, 2000)
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
        {/* Score toast */}
        {savedScore && (
          <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-card px-4 py-3">
            <span className="text-lg">✅</span>
            <span className="text-sm font-medium">
              {currentTest.test_type} guardado — PE: <strong>{savedScore.pe}</strong> ·{' '}
              Percentil: <strong>{savedScore.percentil.toFixed(0)}%</strong> ·{' '}
              <strong>{savedScore.clasificacion}</strong>
            </span>
          </div>
        )}

        {/* Timer (live mode only) */}
        {mode === 'live' && <SessionTimer key={currentTest.test_type} />}

        {/* Test form */}
        <TestFormDispatcher
          testType={currentTest.test_type}
          mode={mode as 'live' | 'paper'}
          onSave={handleSave}
          onSkip={handleSkip}
          saving={saving}
        />
      </main>
    </div>
  )
}
