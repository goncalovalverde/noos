import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
  initialData?: Record<string, unknown>
  initialQual?: Record<string, unknown>
  saveLabel?: string
}

// STAI — Spielberger, Gorsuch & Lushene (1970)
// Adaptación española: Buela-Casal, Guillén-Riquelme & Seisdedos Cubero (2011)
// Estado (E): 20 items, 0=Nada · 1=Algo · 2=Bastante · 3=Mucho
// Rasgo  (R): 20 items, 0=Casi nunca · 1=A veces · 2=A menudo · 3=Casi siempre
// Inverse items are scored: 3 - raw_value

const ESCALA_E = ['Nada', 'Algo', 'Bastante', 'Mucho']
const ESCALA_R = ['Casi nunca', 'A veces', 'A menudo', 'Casi siempre']

interface StaiItem { id: string; texto: string; inverso: boolean }

const ITEMS_E: StaiItem[] = [
  { id: 'e1',  texto: 'Me siento calmado/a',                                                        inverso: true  },
  { id: 'e2',  texto: 'Me siento seguro/a',                                                          inverso: true  },
  { id: 'e3',  texto: 'Estoy tenso/a',                                                               inverso: false },
  { id: 'e4',  texto: 'Estoy contrariado/a',                                                         inverso: false },
  { id: 'e5',  texto: 'Me siento cómodo/a',                                                          inverso: true  },
  { id: 'e6',  texto: 'Me siento alterado/a',                                                        inverso: false },
  { id: 'e7',  texto: 'Estoy preocupado/a ahora por posibles desgracias futuras',                    inverso: false },
  { id: 'e8',  texto: 'Me siento descansado/a',                                                      inverso: true  },
  { id: 'e9',  texto: 'Me siento angustiado/a',                                                      inverso: false },
  { id: 'e10', texto: 'Me siento confortable',                                                       inverso: true  },
  { id: 'e11', texto: 'Tengo confianza en mí mismo/a',                                               inverso: true  },
  { id: 'e12', texto: 'Me siento nervioso/a',                                                        inverso: false },
  { id: 'e13', texto: 'Estoy desasosegado/a',                                                        inverso: false },
  { id: 'e14', texto: 'Me siento muy atado/a (como oprimido/a)',                                     inverso: false },
  { id: 'e15', texto: 'Estoy relajado/a',                                                            inverso: true  },
  { id: 'e16', texto: 'Me siento satisfecho/a',                                                      inverso: true  },
  { id: 'e17', texto: 'Estoy preocupado/a',                                                          inverso: false },
  { id: 'e18', texto: 'Me siento aturdido/a y sobreexcitado/a',                                      inverso: false },
  { id: 'e19', texto: 'Me siento alegre',                                                            inverso: true  },
  { id: 'e20', texto: 'En este momento me siento bien',                                              inverso: true  },
]

const ITEMS_R: StaiItem[] = [
  { id: 'r1',  texto: 'Me siento bien',                                                              inverso: true  },
  { id: 'r2',  texto: 'Me canso rápidamente',                                                        inverso: false },
  { id: 'r3',  texto: 'Siento ganas de llorar',                                                      inverso: false },
  { id: 'r4',  texto: 'Me gustaría ser tan feliz como otros parecen serlo',                          inverso: false },
  { id: 'r5',  texto: 'Pierdo oportunidades por no decidirme pronto',                                inverso: false },
  { id: 'r6',  texto: 'Me siento descansado/a',                                                      inverso: true  },
  { id: 'r7',  texto: 'Soy una persona tranquila, serena y sosegada',                                inverso: true  },
  { id: 'r8',  texto: 'Veo que las dificultades se acumulan y no puedo con ellas',                   inverso: false },
  { id: 'r9',  texto: 'Me preocupo demasiado por cosas sin importancia',                             inverso: false },
  { id: 'r10', texto: 'Soy feliz',                                                                   inverso: true  },
  { id: 'r11', texto: 'Suelo tomar las cosas demasiado en serio',                                    inverso: false },
  { id: 'r12', texto: 'Me falta confianza en mí mismo/a',                                            inverso: false },
  { id: 'r13', texto: 'Me siento seguro/a',                                                          inverso: true  },
  { id: 'r14', texto: 'Evito enfrentarme a las crisis o dificultades',                               inverso: false },
  { id: 'r15', texto: 'Me siento triste (melancólico/a)',                                            inverso: false },
  { id: 'r16', texto: 'Estoy satisfecho/a',                                                          inverso: true  },
  { id: 'r17', texto: 'Me rondan y molestan pensamientos sin importancia',                           inverso: false },
  { id: 'r18', texto: 'Me afectan tanto los desengaños que no me los puedo quitar de la cabeza',    inverso: false },
  { id: 'r19', texto: 'Soy una persona estable',                                                     inverso: true  },
  { id: 'r20', texto: 'Cuando pienso sobre asuntos actuales, me pongo tenso/a y agitado/a',         inverso: false },
]

const computeScore = (items: StaiItem[], values: Record<string, number>) =>
  items.reduce((sum, item) => {
    const v = values[item.id] ?? 0
    return sum + (item.inverso ? 3 - v : v)
  }, 0)

const severityColor = (score: number) =>
  score <= 20 ? 'text-green-600' :
  score <= 30 ? 'text-yellow-600' :
  score <= 44 ? 'text-orange-600' : 'text-red-600'

// ── compact item row ────────────────────────────────────
function ItemRow({
  item,
  value,
  escala,
  onChange,
}: {
  item: StaiItem
  value: number
  escala: string[]
  onChange: (v: number) => void
}) {
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <span className="text-sm text-[#270D38] leading-snug flex-1">{item.texto}</span>
        {item.inverso && (
          <span className="text-[9px] bg-blue-50 text-blue-400 rounded px-1 py-0.5 shrink-0 mt-0.5">inv</span>
        )}
      </div>
      <div className="flex gap-1.5">
        {escala.map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onChange(idx)}
            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all leading-tight ${
              value === idx
                ? 'border-[#9839D1] bg-[#9839D1] text-white'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="font-bold">{idx}</div>
            <div className="mt-0.5 leading-none">{label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── section header ──────────────────────────────────────
function SectionHeader({ title, subtitle, score, answered }: {
  title: string; subtitle: string; score: number; answered: number
}) {
  return (
    <div className="flex items-center justify-between bg-[#f8f7f5] rounded-xl px-4 py-2.5">
      <div>
        <span className="text-xs font-bold text-[#270D38] uppercase tracking-wide">{title}</span>
        <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="text-right">
        <span className={`text-2xl font-bold ${severityColor(score)}`}>{score}</span>
        <span className="text-xs text-gray-400">/60</span>
        <div className="text-[9px] text-gray-400">{answered}/20 resp.</div>
      </div>
    </div>
  )
}

export default function StaiForm({ mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [valE, setValE] = useState<Record<string, number>>(() => {
    const arr = initialData?.estado_items as number[] | undefined
    if (!arr) return Object.fromEntries(ITEMS_E.map(i => [i.id, 0]))
    return Object.fromEntries(ITEMS_E.map((item, idx) => [item.id, arr[idx] ?? 0]))
  })
  const [valR, setValR] = useState<Record<string, number>>(() => {
    const arr = initialData?.rasgo_items as number[] | undefined
    if (!arr) return Object.fromEntries(ITEMS_R.map(i => [i.id, 0]))
    return Object.fromEntries(ITEMS_R.map((item, idx) => [item.id, arr[idx] ?? 0]))
  })
  const [activeTab, setActiveTab] = useState<'E' | 'R'>('E')

  const scoreE = computeScore(ITEMS_E, valE)
  const scoreR = computeScore(ITEMS_R, valR)
  const answeredE = Object.values(valE).filter(v => v > 0).length
  const answeredR = Object.values(valR).filter(v => v > 0).length

  const raw: Record<string, unknown> = {
    estado_items: ITEMS_E.map(i => valE[i.id] ?? 0),
    rasgo_items:  ITEMS_R.map(i => valR[i.id] ?? 0),
    puntuacion_estado: scoreE,
    puntuacion_rasgo:  scoreR,
    total: scoreE + scoreR,
  }

  return (
    <FormBase
      testType="STAI"
      description="Cuestionario de Ansiedad Estado-Rasgo (Spielberger, 1970). Escala E: cómo se siente AHORA. Escala R: cómo se siente EN GENERAL."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={true}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border px-3 py-2.5 text-center ${activeTab === 'E' ? 'border-[#9839D1] bg-[#faf5ff]' : 'border-gray-100'}`}>
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Estado (E)</div>
          <div className={`text-2xl font-bold ${severityColor(scoreE)}`}>{scoreE}<span className="text-xs font-normal text-gray-400">/60</span></div>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 text-center ${activeTab === 'R' ? 'border-[#9839D1] bg-[#faf5ff]' : 'border-gray-100'}`}>
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Rasgo (R)</div>
          <div className={`text-2xl font-bold ${severityColor(scoreR)}`}>{scoreR}<span className="text-xs font-normal text-gray-400">/60</span></div>
        </div>
      </div>

      {/* Reference */}
      <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
        {[
          { range: '0–20', label: 'Baja', color: 'bg-green-50 text-green-700' },
          { range: '21–30', label: 'Media', color: 'bg-yellow-50 text-yellow-700' },
          { range: '31–44', label: 'Alta', color: 'bg-orange-50 text-orange-700' },
          { range: '45–60', label: 'Muy alta', color: 'bg-red-50 text-red-700' },
        ].map(c => (
          <div key={c.label} className={`rounded-lg px-1 py-1.5 font-medium ${c.color}`}>
            <div>{c.range}</div>
            <div>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-gray-100">
        {(['E', 'R'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#9839D1] text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab === 'E' ? `Escala E — Estado (${answeredE}/20)` : `Escala R — Rasgo (${answeredR}/20)`}
          </button>
        ))}
      </div>

      {/* Items */}
      {activeTab === 'E' && (
        <div className="rounded-xl border border-gray-100 px-4">
          <SectionHeader
            title="Escala Estado (E)"
            subtitle="Cómo se siente AHORA MISMO, en este momento"
            score={scoreE}
            answered={answeredE}
          />
          <div className="pt-1">
            {ITEMS_E.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                value={valE[item.id]}
                escala={ESCALA_E}
                onChange={v => setValE(prev => ({ ...prev, [item.id]: v }))}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'R' && (
        <div className="rounded-xl border border-gray-100 px-4">
          <SectionHeader
            title="Escala Rasgo (R)"
            subtitle="Cómo se siente EN GENERAL, la mayor parte del tiempo"
            score={scoreR}
            answered={answeredR}
          />
          <div className="pt-1">
            {ITEMS_R.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                value={valR[item.id]}
                escala={ESCALA_R}
                onChange={v => setValR(prev => ({ ...prev, [item.id]: v }))}
              />
            ))}
          </div>
        </div>
      )}
    </FormBase>
  )
}
