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

export default function DigitosForm({ mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [directo, setDirecto] = useState(() => initialData?.orden_directo != null ? String(initialData.orden_directo) : '')
  const [inverso, setInverso] = useState(() => initialData?.orden_inverso != null ? String(initialData.orden_inverso) : '')
  const [creciente, setCreciente] = useState(() => initialData?.orden_creciente != null ? String(initialData.orden_creciente) : '')
  const [pe, setPe] = useState(() => initialData?.puntuacion_escalar_wais != null ? String(initialData.puntuacion_escalar_wais) : '')

  const directoN = directo !== '' ? Number(directo) : 0
  const inversoN = inverso !== '' ? Number(inverso) : 0
  const crecienteN = creciente !== '' ? Number(creciente) : 0
  const total = directoN + inversoN + crecienteN

  const raw = {
    orden_directo: directo !== '' ? directoN : null,
    orden_inverso: inverso !== '' ? inversoN : null,
    orden_creciente: creciente !== '' ? crecienteN : null,
    total_bruto: (directo !== '' || inverso !== '' || creciente !== '') ? total : null,
    puntuacion_escalar_wais: pe !== '' ? Number(pe) : null,
  }

  const isValid =
    pe !== '' &&
    Number(pe) >= 1 &&
    Number(pe) <= 19

  const components = [
    { label: 'Orden Directo', val: directo, setter: setDirecto, max: 16, hint: 'Spans 2–9, 2 ensayos/span (máx. 16)' },
    { label: 'Orden Inverso', val: inverso, setter: setInverso, max: 14, hint: 'Spans 2–8, 2 ensayos/span (máx. 14)' },
    { label: 'Orden Creciente', val: creciente, setter: setCreciente, max: 14, hint: 'Spans 2–8, 2 ensayos/span (máx. 14)' },
  ]

  return (
    <FormBase
      testType="Dígitos-WAIS"
      description="WAIS-IV — Dígitos: Orden Directo, Orden Inverso y Orden Creciente"
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      {/* Three raw score components */}
      <div className="grid grid-cols-3 gap-4">
        {components.map(({ label, val, setter, max, hint }) => (
          <div key={label}>
            <label className="block text-sm font-medium text-brand-ink mb-1">{label}</label>
            <input
              type="number"
              min={0}
              max={max}
              value={val}
              onChange={e => setter(e.target.value)}
              placeholder={`0–${max}`}
              className="w-full text-xl font-semibold text-center px-3 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
            <p className="text-xs text-brand-muted mt-1">{hint}</p>
          </div>
        ))}
      </div>

      {/* Auto-computed total */}
      {(directo !== '' || inverso !== '' || creciente !== '') && (
        <div className="rounded-input bg-brand-bg border border-brand-mid/20 px-4 py-2 text-sm text-brand-ink">
          Puntuación bruta total:{' '}
          <strong className="text-brand-dark">{total}</strong>
          <span className="text-brand-muted"> / 44</span>
        </div>
      )}

      {/* PE — required, entered from WAIS-IV normative booklet */}
      <div>
        <label htmlFor="digitos-pe" className="block text-sm font-medium text-brand-ink mb-1">
          Puntuación Escalar WAIS-IV (1–19) <span className="text-clinical-impaired">*</span>
        </label>
        <p className="text-xs text-brand-muted mb-2">
          Consulta la tabla normativa del manual WAIS-IV (por edad) e introduce la Puntuación Escalar (PE) correspondiente a la puntuación bruta total.
        </p>
        <input
          id="digitos-pe"
          type="number"
          min={1}
          max={19}
          value={pe}
          onChange={e => setPe(e.target.value)}
          placeholder="1–19"
          className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
        />
      </div>
    </FormBase>
  )
}
