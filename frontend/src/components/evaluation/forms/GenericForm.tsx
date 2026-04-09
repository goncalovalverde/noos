import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  testType: string
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

export default function GenericForm({ testType, mode: _mode, onSave, onSkip, saving }: Props) {
  const [value, setValue] = useState('')
  const raw = { puntuacion_bruta: Number(value) || 0 }
  const isValid = value !== ''

  return (
    <FormBase
      testType={testType}
      description="Introduce la puntuación total del test."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
    >
      <div>
        <label htmlFor="generic-score" className="block text-sm font-medium text-brand-ink mb-1">
          Puntuación total <span className="text-clinical-impaired">*</span>
        </label>
        <input
          id="generic-score"
          type="number"
          min={0}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="0"
          className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
        />
      </div>
    </FormBase>
  )
}
