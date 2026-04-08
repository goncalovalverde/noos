import { useState } from 'react'
import FormBase from './FormBase'

type WaisTestType =
  | 'Aritmética'
  | 'Semejanzas'
  | 'Vocabulario'
  | 'Matrices'
  | 'Cubos'
  | 'Clave-Números'
  | 'Búsqueda-Símbolos'

interface Props {
  testType: WaisTestType
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

interface SubtestConfig {
  max: number
  label: string
  description: string
  extraFields: ExtraField[]
}

interface ExtraField {
  key: 'errores' | 'tiempo_total'
  label: string
  max: number
}

const SUBTEST_CONFIG: Record<WaisTestType, SubtestConfig> = {
  Aritmética: {
    max: 22,
    label: 'Puntuación total (0–22)',
    description: 'WAIS-IV — Resolución de problemas aritméticos orales con límite de tiempo',
    extraFields: [{ key: 'tiempo_total', label: 'Tiempo total (seg)', max: 600 }],
  },
  Semejanzas: {
    max: 36,
    label: 'Puntuación total (0–36)',
    description: 'WAIS-IV — Concepto común entre dos palabras (0–2 pts/ítem, 18 ítems)',
    extraFields: [],
  },
  Vocabulario: {
    max: 80,
    label: 'Puntuación total (0–80)',
    description: 'WAIS-IV — Definición de palabras (0–2 pts/ítem, 30 ítems)',
    extraFields: [],
  },
  Matrices: {
    max: 26,
    label: 'Puntuación total (0–26)',
    description: 'WAIS-IV — Razonamiento matricial no verbal (0–26)',
    extraFields: [],
  },
  Cubos: {
    max: 68,
    label: 'Puntuación total con bonificación (0–68)',
    description: 'WAIS-IV — Reproducción de diseños con cubos; incluye bonificación por tiempo',
    extraFields: [{ key: 'tiempo_total', label: 'Tiempo total (seg)', max: 600 }],
  },
  'Clave-Números': {
    max: 133,
    label: 'Elementos completados en 90 seg (0–133)',
    description: 'WAIS-IV — Velocidad de procesamiento: código numérico en 90 segundos',
    extraFields: [{ key: 'errores', label: 'Errores', max: 20 }],
  },
  'Búsqueda-Símbolos': {
    max: 60,
    label: 'Aciertos en 120 seg (0–60)',
    description: 'WAIS-IV — Velocidad/atención: búsqueda de símbolos en 120 segundos',
    extraFields: [{ key: 'errores', label: 'Errores', max: 20 }],
  },
}

export default function WaisSubtestForm({ testType, mode: _mode, onSave, onSkip, saving }: Props) {
  const config = SUBTEST_CONFIG[testType]

  const [puntuacion, setPuntuacion] = useState('')
  const [extras, setExtras] = useState<Record<string, string>>({})

  const setExtra = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setExtras(prev => ({ ...prev, [key]: e.target.value }))

  const raw: Record<string, unknown> = {
    puntuacion_bruta: puntuacion !== '' ? Number(puntuacion) : null,
    ...Object.fromEntries(
      config.extraFields.map(f => [f.key, extras[f.key] !== undefined && extras[f.key] !== '' ? Number(extras[f.key]) : null])
    ),
  }

  const isValid =
    puntuacion !== '' &&
    Number(puntuacion) >= 0 &&
    Number(puntuacion) <= config.max

  return (
    <FormBase
      testType={testType}
      description={config.description}
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
    >
      {/* Primary score */}
      <div>
        <label htmlFor="wais-puntuacion" className="block text-sm font-medium text-brand-ink mb-1">
          {config.label} <span className="text-clinical-impaired">*</span>
        </label>
        <input
          id="wais-puntuacion"
          type="number"
          min={0}
          max={config.max}
          value={puntuacion}
          onChange={e => setPuntuacion(e.target.value)}
          placeholder={`0–${config.max}`}
          className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
        />
      </div>

      {/* Extra fields */}
      {config.extraFields.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {config.extraFields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-brand-ink mb-1">
                {field.label}{' '}
                <span className="text-brand-muted font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                min={0}
                max={field.max}
                value={extras[field.key] ?? ''}
                onChange={setExtra(field.key)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
            </div>
          ))}
        </div>
      )}
    </FormBase>
  )
}
