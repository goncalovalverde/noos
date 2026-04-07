import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, ClipboardList, PlayCircle, Radio } from 'lucide-react'
import { protocolsApi, type Protocol } from '@/api/protocols'
import { evaluationsApi } from '@/api/evaluations'

export default function EvaluationSetup() {
  const { id: patientId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null)
  const [mode, setMode] = useState<'live' | 'paper'>('live')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    protocolsApi.list().then(setProtocols).finally(() => setLoading(false))
  }, [])

  const handleStart = async () => {
    if (!selectedProtocol || !patientId) return
    setStarting(true)
    setError(null)
    try {
      const plan = await evaluationsApi.create(patientId, selectedProtocol.id, mode)
      await evaluationsApi.update(plan.id, { status: 'active' })
      navigate(`/patients/${patientId}/evaluate/${plan.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Error al iniciar la evaluación. Inténtalo de nuevo.')
    } finally {
      setStarting(false)
    }
  }

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
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Mode selector */}
        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-brand-mid" />
            <h2 className="text-base font-semibold text-brand-ink">Modo de entrada</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'live', label: 'En vivo', desc: 'Paciente presente — cronómetro activo', icon: '⚡' },
              { value: 'paper', label: 'Diferido', desc: 'Transcripción diferida — sin cronómetro', icon: '📋' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value as 'live' | 'paper')}
                className={`text-left p-4 rounded-card border-2 transition-all ${
                  mode === opt.value
                    ? 'border-brand-mid bg-brand-mid/5'
                    : 'border-gray-200 hover:border-brand-mid/40'
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <p className="font-medium text-brand-ink mt-1">{opt.label}</p>
                <p className="text-xs text-brand-muted mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

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
              disabled={starting}
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
