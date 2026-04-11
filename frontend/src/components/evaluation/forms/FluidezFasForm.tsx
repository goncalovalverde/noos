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

export default function FluidezFasForm({ mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [f, setF] = useState(() => initialData?.letra_f != null ? String(initialData.letra_f) : '')
  const [a, setA] = useState(() => initialData?.letra_a != null ? String(initialData.letra_a) : '')
  const [s, setS] = useState(() => initialData?.letra_s != null ? String(initialData.letra_s) : '')
  const [intrusiones, setIntrusiones] = useState(() => initialData?.intrusiones != null ? String(initialData.intrusiones) : '')
  const [perseveraciones, setPerseveraciones] = useState(() => initialData?.perseveraciones != null ? String(initialData.perseveraciones) : '')

  const total = (Number(f) || 0) + (Number(a) || 0) + (Number(s) || 0)
  const raw = {
    letra_f: Number(f) || 0,
    letra_a: Number(a) || 0,
    letra_s: Number(s) || 0,
    intrusiones: intrusiones !== '' ? Number(intrusiones) : null,
    perseveraciones: perseveraciones !== '' ? Number(perseveraciones) : null,
  }
  const isValid = f !== '' && a !== '' && s !== ''

  return (
    <FormBase
      testType="Fluidez-FAS"
      description="Fluidez verbal fonológica — letras F, A, S (60 segundos cada una)"
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      <p className="text-sm text-brand-muted">
        Total: <strong className="text-brand-dark">{total}</strong> palabras
      </p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Letra F', val: f, setter: setF },
          { label: 'Letra A', val: a, setter: setA },
          { label: 'Letra S', val: s, setter: setS },
        ].map(({ label, val, setter }) => (
          <div key={label}>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              {label} <span className="text-clinical-impaired">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={val}
              onChange={e => setter(e.target.value)}
              placeholder="0"
              className="w-full text-xl font-semibold text-center px-3 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-brand-ink mb-1">
            Intrusiones (palabras no válidas){' '}
            <span className="text-brand-muted font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            min={0}
            max={20}
            value={intrusiones}
            onChange={e => setIntrusiones(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-ink mb-1">
            Perseveraciones (repeticiones){' '}
            <span className="text-brand-muted font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            min={0}
            max={20}
            value={perseveraciones}
            onChange={e => setPerseveraciones(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />
        </div>
      </div>
    </FormBase>
  )
}
