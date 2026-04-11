import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  testType: 'TMT-A' | 'TMT-B'
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
  initialData?: Record<string, unknown>
  initialQual?: Record<string, unknown>
  saveLabel?: string
}

const TMT_DESCRIPTIONS: Record<string, string> = {
  'TMT-A': 'Conectar números del 1 al 25 en orden ascendente lo más rápido posible.',
  'TMT-B': 'Alternar entre números y letras (1-A-2-B...) lo más rápido posible.',
}

export default function TmtForm({ testType, mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [tiempo, setTiempo] = useState(() => initialData?.tiempo_segundos != null ? String(initialData.tiempo_segundos) : '')
  const [errores, setErrores] = useState(() => initialData?.errores != null ? String(initialData.errores) : '')

  const raw = { tiempo_segundos: Number(tiempo) }
  const isValid = tiempo !== '' && Number(tiempo) > 0

  return (
    <FormBase
      testType={testType}
      description={TMT_DESCRIPTIONS[testType]}
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      <div>
        <label htmlFor="tmt-tiempo" className="block text-sm font-medium text-brand-ink mb-1">
          Tiempo (segundos) <span className="text-clinical-impaired">*</span>
        </label>
        <input
          id="tmt-tiempo"
          type="number"
          min={1}
          max={testType === 'TMT-B' ? 600 : 300}
          value={tiempo}
          onChange={e => setTiempo(e.target.value)}
          placeholder="ej. 60"
          className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
          aria-label="Tiempo en segundos"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-ink mb-1">
          Errores <span className="text-brand-muted font-normal">(opcional)</span>
        </label>
        <input
          type="number"
          min={0}
          value={errores}
          onChange={e => setErrores(e.target.value)}
          placeholder="0"
          className="w-32 px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
        />
      </div>
    </FormBase>
  )
}
