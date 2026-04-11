import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2, CheckCircle, Calendar, ClipboardList } from 'lucide-react'
import { evaluationsApi, type TestCustomization } from '@/api/evaluations'
import { clinicalSessionsApi, type ClinicalSession } from '@/api/clinicalSessions'
import { extractApiError } from '@/utils/apiError'

export default function RegisterSession() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>()
  const navigate = useNavigate()

  const today = new Date().toISOString().split('T')[0]

  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [allTests, setAllTests] = useState<TestCustomization[]>([])
  const [registeredMap, setRegisteredMap] = useState<Map<string, ClinicalSession | null>>(new Map())
  const [existingSessions, setExistingSessions] = useState<ClinicalSession[]>([])
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [protocolName, setProtocolName] = useState<string | null>(null)

  useEffect(() => {
    if (!planId) return
    Promise.all([
      evaluationsApi.getWithResults(planId),
      clinicalSessionsApi.list(planId),
    ]).then(([planWithResults, sessions]) => {
      setProtocolName(planWithResults.protocol_name ?? null)
      const active = (planWithResults.test_customizations ?? [] as TestCustomization[]).filter((t: TestCustomization) => !t.skip)
      setAllTests(active)
      setExistingSessions(sessions)

      // Build a map: test_type → ClinicalSession that registered it (or null if not registered)
      const sessionById = new Map(sessions.map(s => [s.id, s]))
      const regMap = new Map<string, ClinicalSession | null>()
      for (const r of planWithResults.test_results) {
        const cs = r.clinical_session_id ? (sessionById.get(r.clinical_session_id) ?? null) : null
        regMap.set(r.test_type, cs)
      }
      setRegisteredMap(regMap)

      // Pre-select all unregistered tests
      const unregistered = new Set<string>(active.filter((t: TestCustomization) => !regMap.has(t.test_type)).map((t: TestCustomization) => t.test_type))
      setSelectedTests(unregistered)
    }).catch(() => {
      setError('Erro ao carregar dados do plano.')
    }).finally(() => setLoading(false))
  }, [planId])

  const toggleTest = (testType: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev)
      if (next.has(testType)) next.delete(testType)
      else next.add(testType)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!planId || !patientId || selectedTests.size === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const newSession = await clinicalSessionsApi.create(planId, {
        session_date: date,
        notes: notes.trim() || undefined,
      })
      navigate(`/patients/${patientId}/evaluate/${planId}`, {
        state: {
          sessionId: newSession.id,
          sessionNumber: newSession.session_number,
          sessionDate: newSession.session_date,
          selectedTestTypes: Array.from(selectedTests),
        },
      })
    } catch (err: unknown) {
      setError(extractApiError(err, 'Erro ao criar sessão. Tente novamente.'))
    } finally {
      setSubmitting(false)
    }
  }

  const nextSessionNumber = existingSessions.length + 1

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-brand-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>A carregar…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(`/patients/${patientId}`)}
          className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-ink transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Hub do paciente
        </button>
        <span className="text-brand-muted">·</span>
        <span className="text-sm font-medium text-brand-ink">Registar nova sessão</span>
        {protocolName && (
          <>
            <span className="text-brand-muted">·</span>
            <span className="text-sm text-brand-muted">{protocolName}</span>
          </>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        <div>
          <h1 className="text-xl font-semibold text-[#270D38]">Registar Sessão {nextSessionNumber}</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            {allTests.filter(t => !registeredMap.has(t.test_type)).length} testes por registar
          </p>
        </div>

        {/* Section 1 — Date */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <h2 className="text-sm font-semibold text-[#270D38]">Data da visita</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand-ink mb-1">
                Data em que o teste foi administrado ao paciente
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-muted shrink-0" />
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={e => setDate(e.target.value)}
                  className="w-56 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9839D1]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-ink mb-1">
                Notas da sessão <span className="font-normal text-brand-muted">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: paciente mostrou alguma fadiga no final…"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9839D1] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Test selection */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
            <h2 className="text-sm font-semibold text-[#270D38]">Testes a registar nesta sessão</h2>
          </div>

          <div className="space-y-2">
            {allTests.map(t => {
              const registeredIn = registeredMap.get(t.test_type)
              const isRegistered = registeredMap.has(t.test_type)
              const isSelected = selectedTests.has(t.test_type)

              if (isRegistered) {
                return (
                  <div
                    key={t.test_type}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                  >
                    <div className="w-5 h-5 rounded border-2 border-green-400 bg-green-50 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="flex-1 text-sm text-gray-500 line-through">{t.test_type}</span>
                    <span className="text-xs text-gray-400 font-medium">
                      Sessão {registeredIn?.session_number ?? '?'}
                    </span>
                  </div>
                )
              }

              return (
                <label
                  key={t.test_type}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#ede9fe] bg-[#faf5ff]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTest(t.test_type)}
                    className="w-4 h-4 rounded border-gray-300 text-[#9839D1] focus:ring-[#9839D1] shrink-0"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <ClipboardList className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                    <span className={`text-sm font-medium ${isSelected ? 'text-[#270D38]' : 'text-gray-600'}`}>
                      {t.test_type}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>

          {allTests.filter(t => !registeredMap.has(t.test_type)).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Todos os testes do protocolo já foram registados.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-muted">
            <strong className="text-brand-ink">{selectedTests.size}</strong> teste{selectedTests.size !== 1 ? 's' : ''} seleccionado{selectedTests.size !== 1 ? 's' : ''}
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedTests.size === 0}
            className="flex items-center gap-2 bg-[#9839D1] hover:bg-[#7c2fb5] text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Continuar →
          </button>
        </div>

      </div>
    </div>
  )
}
