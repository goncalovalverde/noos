import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

// BDI-II — 21 items, each 0-3 (Beck, Steer & Brown, 1996)
// Total 0–63. Cutoffs: 0–13 Mínima · 14–19 Leve · 20–28 Moderada · 29+ Grave

const ITEMS: { id: string; tema: string; opciones: string[] }[] = [
  {
    id: 'tristeza',
    tema: '1. Tristeza',
    opciones: [
      'No me siento triste',
      'Me siento triste gran parte del tiempo',
      'Me siento triste continuamente',
      'Me siento tan triste o tan desgraciado que no puedo soportarlo',
    ],
  },
  {
    id: 'pesimismo',
    tema: '2. Pesimismo',
    opciones: [
      'No estoy desanimado sobre mi futuro',
      'Me siento más desanimado sobre mi futuro que antes',
      'No espero que las cosas mejoren',
      'Siento que mi futuro es desesperado y que las cosas sólo empeorarán',
    ],
  },
  {
    id: 'fracaso',
    tema: '3. Fracasos pasados',
    opciones: [
      'No me siento fracasado',
      'He fracasado más de lo que debería',
      'Cuando miro atrás, veo muchos fracasos',
      'Siento que como persona soy un fracaso total',
    ],
  },
  {
    id: 'placer',
    tema: '4. Pérdida de placer',
    opciones: [
      'Disfruto de las cosas que me gustan tanto como antes',
      'No disfruto de las cosas tanto como antes',
      'Obtengo muy poco placer de las cosas con las que solía disfrutar',
      'No puedo obtener ningún placer de las cosas con las que solía disfrutar',
    ],
  },
  {
    id: 'culpa',
    tema: '5. Sentimientos de culpa',
    opciones: [
      'No me siento particularmente culpable',
      'Me siento culpable de muchas cosas que he hecho o debería haber hecho',
      'Me siento bastante culpable la mayor parte del tiempo',
      'Me siento culpable constantemente',
    ],
  },
  {
    id: 'castigo',
    tema: '6. Sentimientos de castigo',
    opciones: [
      'No siento que esté siendo castigado',
      'Siento que puedo ser castigado',
      'Espero ser castigado',
      'Siento que estoy siendo castigado',
    ],
  },
  {
    id: 'autoconcepto',
    tema: '7. Autocrítica',
    opciones: [
      'Siento lo mismo que antes sobre mí mismo',
      'He perdido confianza en mí mismo',
      'Estoy decepcionado conmigo mismo',
      'Me odio',
    ],
  },
  {
    id: 'autocritica',
    tema: '8. Pensamientos o deseos suicidas',
    opciones: [
      'No tengo ningún pensamiento de hacerme daño',
      'He tenido pensamientos de hacerme daño pero no los llevaría a cabo',
      'Querría matarme',
      'Me mataría si tuviese la oportunidad de hacerlo',
    ],
  },
  {
    id: 'llanto',
    tema: '9. Llanto',
    opciones: [
      'No lloro más de lo que solía hacer',
      'Lloro más de lo que solía',
      'Lloro por cualquier cosa',
      'Tengo ganas de llorar pero no puedo',
    ],
  },
  {
    id: 'agitacion',
    tema: '10. Agitación',
    opciones: [
      'No estoy más inquieto o tenso que de costumbre',
      'Me siento más inquieto o tenso que de costumbre',
      'Estoy tan inquieto o agitado que me es difícil quedarme quieto',
      'Estoy tan inquieto o agitado que tengo que estar continuamente moviéndome o haciendo algo',
    ],
  },
  {
    id: 'interes',
    tema: '11. Pérdida de interés',
    opciones: [
      'No he perdido el interés por otras personas o actividades',
      'Estoy menos interesado que antes por otras personas o actividades',
      'He perdido la mayor parte de mi interés por los demás o por las cosas',
      'Me es difícil interesarme en algo',
    ],
  },
  {
    id: 'decision',
    tema: '12. Indecisión',
    opciones: [
      'Tomo mis propias decisiones tan bien como antes',
      'Me resulta más difícil que de costumbre tomar decisiones',
      'Encuentro mucha dificultad para tomar decisiones',
      'Tengo problemas para tomar cualquier decisión',
    ],
  },
  {
    id: 'inutilidad',
    tema: '13. Sentimientos de inutilidad',
    opciones: [
      'No me siento inútil',
      'No me considero tan valioso y útil como solía ser',
      'Me siento inútil en comparación con otras personas',
      'Me siento completamente inútil',
    ],
  },
  {
    id: 'energia',
    tema: '14. Pérdida de energía',
    opciones: [
      'Tengo tanta energía como siempre',
      'Tengo menos energía que de costumbre',
      'No tengo suficiente energía para hacer muchas cosas',
      'No tengo suficiente energía para hacer nada',
    ],
  },
  {
    id: 'suenio',
    tema: '15. Cambios en los hábitos de sueño',
    opciones: [
      'He mantenido mis hábitos de sueño habituales',
      'Duermo algo más / menos de lo habitual',
      'Duermo bastante más / menos de lo habitual',
      'Duermo la mayor parte del día / me despierto 1-2h antes y no puedo volver a dormir',
    ],
  },
  {
    id: 'irritabilidad',
    tema: '16. Irritabilidad',
    opciones: [
      'No estoy más irritable que de costumbre',
      'Estoy más irritable que de costumbre',
      'Estoy mucho más irritable que de costumbre',
      'Estoy irritable continuamente',
    ],
  },
  {
    id: 'apetito',
    tema: '17. Cambios en el apetito',
    opciones: [
      'Mi apetito no ha cambiado',
      'Mi apetito es algo menor / mayor que de costumbre',
      'Mi apetito es bastante menor / mayor que de costumbre',
      'No tengo nada de apetito / tengo mucho más apetito que de costumbre',
    ],
  },
  {
    id: 'concentracion',
    tema: '18. Dificultad de concentración',
    opciones: [
      'Puedo concentrarme tan bien como siempre',
      'No puedo concentrarme tan bien como habitualmente',
      'Me es difícil mantener la mente en algo por mucho tiempo',
      'Encuentro que no puedo concentrarme en nada',
    ],
  },
  {
    id: 'cansancio',
    tema: '19. Cansancio o fatiga',
    opciones: [
      'No estoy más cansado o fatigado que de costumbre',
      'Me canso o me fatigo más fácilmente que de costumbre',
      'Estoy demasiado cansado o fatigado para hacer muchas de las cosas que solía hacer',
      'Estoy demasiado cansado o fatigado para hacer la mayoría de las cosas que solía hacer',
    ],
  },
  {
    id: 'libido',
    tema: '20. Pérdida de interés en el sexo',
    opciones: [
      'No he notado ningún cambio reciente en mi interés por el sexo',
      'Estoy menos interesado por el sexo que de costumbre',
      'Estoy mucho menos interesado por el sexo ahora',
      'He perdido completamente el interés por el sexo',
    ],
  },
  {
    id: 'hipocondria',
    tema: '21. Pérdida de interés en la salud',
    opciones: [
      'No noto ningún cambio reciente en mi salud',
      'Estoy preocupado por problemas físicos como dolores, malestar, estómago o estreñimiento',
      'Estoy muy preocupado por problemas físicos y me es difícil pensar en otras cosas',
      'Estoy tan preocupado por problemas físicos que no puedo pensar en nada más',
    ],
  },
]

const CLASSIFICATION = (score: number) => {
  if (score <= 13) return { label: 'Mínima', color: 'text-green-600', bg: 'bg-green-50' }
  if (score <= 19) return { label: 'Leve', color: 'text-yellow-600', bg: 'bg-yellow-50' }
  if (score <= 28) return { label: 'Moderada', color: 'text-orange-600', bg: 'bg-orange-50' }
  return { label: 'Grave', color: 'text-red-600', bg: 'bg-red-50' }
}

export default function BeckForm({ mode: _mode, onSave, onSkip, saving }: Props) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(ITEMS.map(i => [i.id, 0]))
  )

  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const cls = CLASSIFICATION(total)
  const answered = Object.values(scores).filter(v => v > 0).length

  const raw: Record<string, unknown> = {
    ...Object.fromEntries(ITEMS.map(i => [i.id, scores[i.id]])),
    total,
  }

  return (
    <FormBase
      testType="BDI-II"
      description="Inventario de Depresión de Beck — Segunda Edición (Beck, Steer & Brown, 1996). 21 ítems, 0–63 puntos."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={true}
    >
      {/* Live total */}
      <div className={`flex items-center justify-between border rounded-xl px-4 py-3 -mt-1 ${cls.bg} border-opacity-50`}
           style={{ borderColor: 'currentColor' }}>
        <div>
          <span className="text-sm font-medium text-[#270D38]">Puntuación total</span>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Respondidos: {answered} / 21
          </p>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${cls.color}`}>{total}</span>
          <span className="text-base text-gray-400"> / 63</span>
          <div className={`text-xs font-semibold mt-0.5 ${cls.color}`}>{cls.label}</div>
        </div>
      </div>

      {/* Cutoff reference */}
      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
        {[
          { range: '0–13', label: 'Mínima', color: 'bg-green-50 text-green-700' },
          { range: '14–19', label: 'Leve', color: 'bg-yellow-50 text-yellow-700' },
          { range: '20–28', label: 'Moderada', color: 'bg-orange-50 text-orange-700' },
          { range: '29–63', label: 'Grave', color: 'bg-red-50 text-red-700' },
        ].map(c => (
          <div key={c.label} className={`rounded-lg px-1.5 py-1.5 font-medium ${c.color}`}>
            <div>{c.range}</div>
            <div>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {ITEMS.map(item => {
          const val = scores[item.id]
          return (
            <div key={item.id} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between bg-[#f8f7f5] px-4 py-2">
                <span className="text-xs font-semibold text-[#270D38]">{item.tema}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  val === 0 ? 'bg-gray-100 text-gray-400' :
                  val === 1 ? 'bg-yellow-100 text-yellow-700' :
                  val === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                }`}>
                  {val}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {item.opciones.map((opcion, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      val === idx ? 'bg-[#faf5ff]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      val === idx ? 'border-[#9839D1] bg-[#9839D1]' : 'border-gray-300'
                    }`}>
                      {val === idx && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex items-start gap-2 flex-1">
                      <span className={`text-xs font-bold mt-0.5 shrink-0 ${
                        val === idx ? 'text-[#9839D1]' : 'text-gray-300'
                      }`}>{idx}</span>
                      <span className="text-sm text-[#270D38] leading-snug">{opcion}</span>
                    </div>
                    <input
                      type="radio"
                      name={item.id}
                      value={idx}
                      checked={val === idx}
                      onChange={() => setScores(prev => ({ ...prev, [item.id]: idx }))}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </FormBase>
  )
}
