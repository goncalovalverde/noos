import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { evaluationsApi, type TestCustomization } from '@/api/evaluations'
import { clinicalSessionsApi, type ClinicalSession } from '@/api/clinicalSessions'
import { patientsApi } from '@/api/patients'
import { extractApiError } from '@/utils/apiError'

// Category labels for known test types
const TEST_CATEGORIES: Record<string, string> = {
  'TMT-A': 'Atenção · Velocidade de processamento',
  'TMT-B': 'Função executiva · Flexibilidade mental',
  'TAVEC': 'Memória verbal · Aprendizagem',
  'Fluidez-FAS': 'Linguagem · Fluência verbal fonológica',
  'FAS-Verbal': 'Linguagem · Fluência verbal fonológica',
  'Rey-Copia': 'Função visuoconstrutiva · Cópia',
  'Rey-Memoria': 'Memória visual · Evocação diferida',
  'Dígitos-Directos': 'Memória de trabalho · Span direto',
  'Dígitos-Inversos': 'Memória de trabalho · Span inverso',
  'Letras-Números': 'Memória de trabalho · Sequenciação',
  'Aritmética': 'Memória de trabalho · Cálculo',
  'Clave-Números': 'Velocidade de processamento · Codificação',
  'Búsqueda-Símbolos': 'Velocidade de processamento · Varrimento visual',
  'Semejanzas': 'Linguagem · Abstração verbal',
  'Vocabulario': 'Linguagem · Conhecimento léxico',
  'Matrices': 'Raciocínio · Inteligência fluida',
  'Cubos': 'Função visuoespacial · Construção',
  'Torre-Londres': 'Função executiva · Planificação',
  'Stroop': 'Função executiva · Inibição de resposta',
}

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
  const [patientDisplayId, setPatientDisplayId] = useState<string | null>(null)

  useEffect(() => {
    if (!planId || !patientId) return
    Promise.all([
      evaluationsApi.getWithResults(planId),
      clinicalSessionsApi.list(planId),
      patientsApi.get(patientId),
    ]).then(([planWithResults, sessions, patient]) => {
      setProtocolName(planWithResults.protocol_name ?? null)
      setPatientDisplayId(patient.display_id ?? null)
      const active = (planWithResults.test_customizations ?? [] as TestCustomization[]).filter((t: TestCustomization) => !t.skip)
      setAllTests(active)
      setExistingSessions(sessions)

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
  }, [planId, patientId])

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
  const pendingCount = allTests.filter((t: TestCustomization) => !registeredMap.has(t.test_type)).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-brand-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>A carregar…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F5] flex flex-col">

      {/* Topbar — matches mock-8 View 2 */}
      <div className="bg-white border-b border-black/[0.07] px-5 py-0 flex items-center gap-3 h-12 shrink-0">
        <div className="w-7 h-7 rounded-full bg-[#9839D1] text-white text-xs font-bold flex items-center justify-center shrink-0">N</div>
        <span className="font-semibold text-[#270D38] text-sm">Nóos</span>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {patientDisplayId && (
          <>
            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">
              {patientDisplayId.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-[#270D38]">{patientDisplayId}</span>
            <div className="w-px h-5 bg-gray-200 mx-1" />
          </>
        )}
        {protocolName && (
          <>
            <span className="text-sm text-[#270D38]"><strong>{protocolName}</strong></span>
            <div className="w-px h-5 bg-gray-200 mx-1" />
          </>
        )}
        <div className="ml-auto">
          <button
            onClick={() => navigate(`/patients/${patientId}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-muted hover:text-brand-ink transition-colors px-2 py-1.5 rounded hover:bg-gray-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Voltar ao hub
          </button>
        </div>
      </div>

      {/* Form shell */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">

          <div className="mb-6">
            <h1 className="text-xl font-semibold text-[#270D38]">Registar Sessão {nextSessionNumber}</h1>
            <p className="text-sm text-[#7E7E7E] mt-0.5">
              {protocolName ? `Protocolo: ${protocolName} · ` : ''}{pendingCount} teste{pendingCount !== 1 ? 's' : ''} por registar
            </p>
          </div>

          {/* Section 1 — Date & Notes */}
          <div className="bg-white rounded-xl border border-black/[0.06] p-6 mb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-[#f3e8ff] text-[#9839D1] flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <h2 className="text-sm font-semibold text-[#270D38]">Data da visita clínica</h2>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-[#270D38] mb-0.5">
                Data em que o teste foi administrado ao paciente
              </label>
              <p className="text-[11px] text-[#9ca3af] mb-2">Pode ser hoje ou uma data anterior</p>
              <input
                type="date"
                value={date}
                max={today}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9839D1] bg-[#F9F7F5]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#270D38] mb-0.5">
                Notas gerais da sessão{' '}
                <span className="font-normal text-[#9ca3af]">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: paciente mostrou alguma fadiga no final…"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9839D1] resize-none bg-[#F9F7F5]"
              />
            </div>
          </div>

          {/* Section 2 — Test selection */}
          <div className="bg-white rounded-xl border border-black/[0.06] p-6 mb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-[#f3e8ff] text-[#9839D1] flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <h2 className="text-sm font-semibold text-[#270D38]">Que testes foram administrados nesta visita?</h2>
            </div>

            <div className="space-y-2">
              {allTests.map((t: TestCustomization) => {
                const registeredIn = registeredMap.get(t.test_type)
                const isRegistered = registeredMap.has(t.test_type)
                const isSelected = selectedTests.has(t.test_type)
                const category = TEST_CATEGORIES[t.test_type]

                if (isRegistered) {
                  return (
                    <div
                      key={t.test_type}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-100 bg-[#f8f7f5] cursor-not-allowed"
                      title={`Já registado na Sessão ${registeredIn?.session_number ?? '?'}`}
                    >
                      {/* checked circle */}
                      <div className="w-5 h-5 rounded border-2 border-green-400 bg-green-50 flex items-center justify-center shrink-0">
                        <svg width="11" height="11" fill="none" stroke="#16a34a" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-400 font-medium">{t.test_type}</div>
                        {category && <div className="text-[11px] text-gray-300 truncate">{category}</div>}
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0">
                        <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                        Registado S{registeredIn?.session_number ?? '?'}
                      </div>
                    </div>
                  )
                }

                return (
                  <button
                    key={t.test_type}
                    type="button"
                    onClick={() => toggleTest(t.test_type)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-[#c4b5fd] bg-[#faf5ff]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* checkbox */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-[#9839D1] bg-[#9839D1]' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg width="11" height="11" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isSelected ? 'text-[#270D38]' : 'text-gray-600'}`}>{t.test_type}</div>
                      {category && <div className="text-[11px] text-gray-400 truncate">{category}</div>}
                    </div>
                  </button>
                )
              })}
            </div>

            {pendingCount === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Todos os testes do protocolo já foram registados.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-[#7E7E7E]">
              <strong className="text-[#270D38]">{selectedTests.size}</strong> teste{selectedTests.size !== 1 ? 's' : ''} seleccionado{selectedTests.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/patients/${patientId}`)}
                className="px-4 py-2 text-sm font-medium text-[#7E7E7E] border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedTests.size === 0}
                className="flex items-center gap-2 bg-[#9839D1] hover:bg-[#7c2fb5] text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continuar para introdução de scores
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
