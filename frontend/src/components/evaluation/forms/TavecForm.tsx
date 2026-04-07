import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip: () => void
  saving: boolean
}

type TavecKey = 'ensayo_1' | 'ensayo_2' | 'ensayo_3' | 'ensayo_4' | 'ensayo_5' |
  'lista_b' | 'recuerdo_inmediato' | 'recuerdo_demorado' |
  'reconocimiento_aciertos' | 'reconocimiento_errores'

const INITIAL: Record<TavecKey, string> = {
  ensayo_1: '', ensayo_2: '', ensayo_3: '', ensayo_4: '', ensayo_5: '',
  lista_b: '', recuerdo_inmediato: '', recuerdo_demorado: '',
  reconocimiento_aciertos: '', reconocimiento_errores: '',
}

export default function TavecForm({ mode, onSave, onSkip, saving }: Props) {
  const [values, setValues] = useState(INITIAL)

  const set = (k: TavecKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(prev => ({ ...prev, [k]: e.target.value }))

  const raw = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0]))
  const total = ([1, 2, 3, 4, 5] as const).reduce(
    (s, i) => s + (Number(values[`ensayo_${i}` as TavecKey]) || 0), 0
  )
  const isValid = values.ensayo_1 !== ''

  return (
    <FormBase
      testType="TAVEC"
      description="Test de Aprendizaje Verbal España-Complutense"
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
    >
      <div>
        <p className="text-sm font-medium text-brand-ink mb-2">
          Ensayos 1–5 <span className="text-brand-muted">(total: {total})</span>
        </p>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map(i => (
            <div key={i} className="flex-1">
              <label className="block text-xs text-brand-muted mb-1 text-center">E{i}</label>
              <input
                type="number"
                min={0}
                max={16}
                value={values[`ensayo_${i}` as TavecKey]}
                onChange={set(`ensayo_${i}` as TavecKey)}
                placeholder="0"
                className="w-full text-center px-2 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'lista_b' as TavecKey, label: 'Lista B' },
          { key: 'recuerdo_inmediato' as TavecKey, label: 'Recuerdo inmediato' },
          { key: 'recuerdo_demorado' as TavecKey, label: 'Recuerdo demorado' },
          { key: 'reconocimiento_aciertos' as TavecKey, label: 'Reconocimiento aciertos' },
          { key: 'reconocimiento_errores' as TavecKey, label: 'Reconocimiento errores' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-brand-ink mb-1">{label}</label>
            <input
              type="number"
              min={0}
              value={values[key]}
              onChange={set(key)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        ))}
      </div>
    </FormBase>
  )
}
