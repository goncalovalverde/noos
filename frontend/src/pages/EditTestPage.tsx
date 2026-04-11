import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Loader2, RefreshCw } from 'lucide-react'
import { testsApi } from '@/api/tests'
import type { TestSessionOut } from '@/types/patient'
import TestFormDispatcher from '@/components/evaluation/TestFormDispatcher'
import { extractApiError } from '@/utils/apiError'

const CLASSIFICATION_COLORS: Record<string, string> = {
  'Superior':   'text-[#15803d]',
  'Normal':     'text-[#1d4ed8]',
  'Limítrofe':  'text-[#a16207]',
  'Deficitario':'text-[#b91c1c]',
}

export default function EditTestPage() {
  const { id: patientId, planId: _planId, testId } = useParams<{ id: string; planId: string; testId: string }>()
  const navigate = useNavigate()

  const [testResult, setTestResult] = useState<TestSessionOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedScore, setUpdatedScore] = useState<{
    pe: number | null
    percentil: number | null
    clasificacion: string
    testType: string
    noNorm?: boolean
  } | null>(null)

  useEffect(() => {
    if (!testId) return
    testsApi.get(testId)
      .then(setTestResult)
      .catch(err => setError(extractApiError(err, 'No se pudo cargar el resultado del test')))
      .finally(() => setLoading(false))
  }, [testId])

  const handleSave = async (rawData: Record<string, unknown>, qualData?: Record<string, unknown>) => {
    if (!testId) return
    setSaving(true)
    try {
      const result = await testsApi.update(testId, rawData, qualData)
      const scores = result.calculated_scores
      setUpdatedScore({
        pe: scores?.puntuacion_escalar ?? null,
        percentil: scores?.percentil ?? null,
        clasificacion: scores?.clasificacion ?? '',
        testType: result.test_type,
        noNorm: scores?.norma_aplicada?.['fuente'] === 'Sin tabla normativa',
      })
    } catch (err) {
      setError(extractApiError(err, 'Error al guardar los cambios'))
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => navigate(`/patients/${patientId}`)

  if (loading) return (
    <div className="flex items-center justify-center h-screen gap-2 text-brand-muted">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Cargando test…</span>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-brand-muted">
      <p className="text-red-500">{error}</p>
      <button onClick={handleClose} className="text-brand-mid hover:underline text-sm">Volver al paciente</button>
    </div>
  )

  if (!testResult) return null

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 shrink-0">
              <RefreshCw className="w-3 h-3" />
              Edición de resultado
            </span>
            <span className="text-sm text-brand-muted truncate">{testResult.test_type}</span>
          </div>
          <button
            onClick={handleClose}
            className="text-brand-muted hover:text-brand-ink shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Warning banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs text-amber-800">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>
            Estás editando un resultado ya registrado. Al guardar, el resultado anterior será reemplazado
            y quedará registrado como <strong>actualizado</strong>.
          </span>
        </div>
      </div>

      {/* Test form */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <TestFormDispatcher
          testType={testResult.test_type}
          mode="paper"
          onSave={handleSave}
          saving={saving}
        />
      </main>

      {/* Updated result modal */}
      {updatedScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[16px] shadow-xl w-full max-w-sm mx-4 p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-brand-ink mb-1">{updatedScore.testType}</h2>
            <p className="text-brand-muted text-sm mb-1">Resultado actualizado</p>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 mb-6">
              Actualizado
            </span>

            <div className="w-full grid grid-cols-3 gap-3 mb-6">
              <div className="bg-brand-bg rounded-xl p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.7px] text-brand-muted mb-1">PE</p>
                <p className="text-2xl font-semibold text-brand-ink">{updatedScore.pe ?? '—'}</p>
              </div>
              <div className="bg-brand-bg rounded-xl p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.7px] text-brand-muted mb-1">Percentil</p>
                <p className="text-2xl font-semibold text-brand-ink">
                  {updatedScore.percentil != null ? updatedScore.percentil.toFixed(0) : '—'}
                </p>
              </div>
              <div className="bg-brand-bg rounded-xl p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.7px] text-brand-muted mb-1">Clasif.</p>
                {updatedScore.clasificacion === 'Sin norma validada'
                  ? <p className="text-base font-semibold text-gray-400">Sin norma</p>
                  : <p className={`text-base font-semibold ${CLASSIFICATION_COLORS[updatedScore.clasificacion] ?? 'text-brand-ink'}`}>
                      {updatedScore.clasificacion}
                    </p>
                }
              </div>
            </div>

            {updatedScore.noNorm && (
              <p className="text-xs text-gray-400 mb-6 text-center">
                Sin tablas normativas validadas para este test
              </p>
            )}

            <button
              onClick={handleClose}
              className="w-full bg-brand-mid hover:bg-brand-dark text-white font-medium py-2.5 rounded-btn transition-colors"
            >
              Volver al paciente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
