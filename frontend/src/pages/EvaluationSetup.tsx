import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, ClipboardList, PlayCircle, CalendarDays, ListChecks, Plus, X } from 'lucide-react'
import { protocolsApi, type Protocol } from '@/api/protocols'
import { evaluationsApi, type TestCustomization } from '@/api/evaluations'
import { extractApiError } from '@/utils/apiError'

const ALL_TEST_TYPES = [
  'TMT-A', 'TMT-B', 'TAVEC', 'Fluidez-FAS', 'Rey-Copia', 'Rey-Memoria',
  'Dígitos-Directos', 'Dígitos-Inversos', 'Letras-Números', 'Aritmética',
  'Clave-Números', 'Búsqueda-Símbolos', 'Semejanzas', 'Vocabulario',
  'Matrices', 'Cubos', 'Torre-Londres', 'Stroop', 'FAS-Verbal',
]

export default function EvaluationSetup() {
  const { id: patientId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null)
  const [performedDate, setPerformedDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Customization state — built from protocol tests when one is selected
  const [customTests, setCustomTests] = useState<TestCustomization[]>([])
  const [addTestType, setAddTestType] = useState('')

  useEffect(() => {
    protocolsApi.list().then(setProtocols).finally(() => setLoading(false))
  }, [])

  // Reset customizations when protocol changes
  useEffect(() => {
    if (!selectedProtocol) { setCustomTests([]); return }
    setCustomTests(
      selectedProtocol.tests
        .sort((a, b) => a.order - b.order)
        .map(t => ({ test_type: t.test_type, order: t.order, skip: false, added: false, repeat_later: false, notes: '' }))
    )
  }, [selectedProtocol])

  const toggleTest = (testType: string) =>
    setCustomTests(prev => prev.map(t => t.test_type === testType ? { ...t, skip: !t.skip } : t))

  const addTest = () => {
    if (!addTestType) return
    setCustomTests(prev => {
      const next = [...prev, { test_type: addTestType, order: prev.length + 1, skip: false, added: true, repeat_later: false, notes: '' }]
      return next.map((t, i) => ({ ...t, order: i + 1 }))
    })
    setAddTestType('')
  }

  const removeAddedTest = (testType: string) =>
    setCustomTests(prev => prev.filter(t => t.test_type !== testType).map((t, i) => ({ ...t, order: i + 1 })))

  const handleStart = async () => {
    if (!selectedProtocol || !patientId) return
    setStarting(true)
    setError(null)
    try {
      const performed_at = performedDate ? new Date(performedDate).toISOString() : undefined
      const plan = await evaluationsApi.create(patientId, selectedProtocol.id, 'paper', performed_at)
      // Apply customizations if protocol allows it and user made changes
      if (selectedProtocol.allow_customization) {
        await evaluationsApi.update(plan.id, { test_customizations: customTests })
      }
      await evaluationsApi.update(plan.id, { status: 'active' })
      navigate(`/patients/${patientId}/evaluate/${plan.id}`)
    } catch (err: unknown) {
      setError(extractApiError(err, 'Error al iniciar la evaluación. Inténtalo de nuevo.'))
    } finally {
      setStarting(false)
    }
  }

  const activeCount = customTests.filter(t => !t.skip).length
  const availableToAdd = ALL_TEST_TYPES.filter(tt => !customTests.find(t => t.test_type === tt))

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Minimal header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to={`/patients/${patientId}`} className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-ink">
          <ChevronLeft className="w-4 h-4" />
          Volver al paciente
        </Link>
        <span className="text-brand-muted">·</span>
        <span className="text-sm font-medium text-brand-ink">Nueva Evaluación</span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Step 1: Select protocol */}
        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-brand-mid" />
            <h2 className="text-base font-semibold text-brand-ink">Seleccionar protocolo</h2>
          </div>

          {loading ? (
            <p className="text-sm text-brand-muted">Cargando protocolos…</p>
          ) : protocols.length === 0 ? (
            <p className="text-sm text-brand-muted">No hay protocolos disponibles.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {protocols.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProtocol(prev => prev?.id === p.id ? null : p)}
                  className={`text-left p-4 rounded-card border-2 transition-all ${
                    selectedProtocol?.id === p.id
                      ? 'border-brand-mid bg-brand-mid/5'
                      : 'border-gray-200 hover:border-brand-mid/40'
                  }`}
                >
                  <p className="font-medium text-brand-ink">{p.name}</p>
                  {p.category && <p className="text-xs text-brand-muted mt-0.5">{p.category}</p>}
                  <p className="text-xs text-brand-muted mt-2">
                    {p.tests.length} tests: {p.tests.map(t => t.test_type).join(', ')}
                  </p>
                  {!p.allow_customization && (
                    <p className="text-[10px] text-[#a16207] bg-[#fef9c3] rounded-full px-2 py-0.5 mt-2 w-fit">Sin personalización</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Date of evaluation */}
        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-brand-mid" />
            <h2 className="text-base font-semibold text-brand-ink">Data de realização</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Quando foi administrada esta avaliação ao paciente?
            </label>
            <p className="text-xs text-brand-muted mb-3">Pode ser hoje ou uma data anterior. Se deixar vazio usa-se a data de hoje.</p>
            <input
              type="date"
              value={performedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setPerformedDate(e.target.value)}
              className="w-56 px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        </div>

        {/* Step 3: Customize tests (only when protocol allows it) */}
        {selectedProtocol?.allow_customization && customTests.length > 0 && (
          <div className="bg-white rounded-card shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-brand-mid" />
                <h2 className="text-base font-semibold text-brand-ink">Personalizar tests</h2>
              </div>
              <span className="text-xs text-brand-muted">{activeCount} de {customTests.length} activos</span>
            </div>

            {/* Test list with toggles */}
            <div className="space-y-1 mb-4">
              {customTests.map((t) => (
                <div
                  key={t.test_type}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    t.skip
                      ? 'border-gray-100 bg-gray-50 opacity-50'
                      : 'border-[#ede9fe] bg-[#faf5ff]'
                  }`}
                >
                  <span className="w-5 h-5 rounded flex items-center justify-center bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0">
                    {t.order}
                  </span>
                  <span className={`flex-1 text-sm font-medium ${t.skip ? 'line-through text-brand-muted' : 'text-brand-ink'}`}>
                    {t.test_type}
                  </span>
                  {t.added && (
                    <span className="text-[10px] font-medium text-brand-mid bg-[#ede9fe] px-1.5 py-0.5 rounded-full">Añadido</span>
                  )}
                  {t.added ? (
                    <button
                      onClick={() => removeAddedTest(t.test_type)}
                      className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors shrink-0"
                      title="Quitar test añadido"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleTest(t.test_type)}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${!t.skip ? 'bg-brand-mid' : 'bg-gray-200'}`}
                      role="switch"
                      aria-checked={!t.skip}
                      title={t.skip ? 'Activar test' : 'Desactivar test'}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${!t.skip ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add extra test */}
            {availableToAdd.length > 0 && (
              <div className="flex gap-2 pt-3 border-t border-dashed border-purple-200">
                <select
                  value={addTestType}
                  onChange={e => setAddTestType(e.target.value)}
                  className="flex-1 bg-brand-bg border border-dashed border-purple-300 rounded-input px-3 py-2 text-sm text-brand-ink focus:outline-none focus:border-brand-mid focus:border-solid"
                >
                  <option value="">Añadir test adicional…</option>
                  {availableToAdd.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                </select>
                <button
                  type="button"
                  onClick={addTest}
                  disabled={!addTestType}
                  className="flex items-center gap-1 bg-brand-mid text-white px-3 py-2 rounded-btn text-sm font-semibold disabled:opacity-40 hover:bg-brand-dark transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-card px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Start button */}
        {selectedProtocol && (
          <div className="flex justify-end">
            <button
              onClick={handleStart}
              disabled={starting || activeCount === 0}
              className="flex items-center gap-2 bg-brand-mid text-white font-medium px-8 py-3 rounded-btn hover:bg-brand-dark transition-colors disabled:opacity-60 text-base"
            >
              <PlayCircle className="w-5 h-5" />
              {starting ? 'Iniciando…' : 'Iniciar evaluación'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
