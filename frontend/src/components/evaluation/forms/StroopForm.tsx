import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

export default function StroopForm({ mode: _mode, onSave, onSkip, saving }: Props) {
  const [palabras, setPalabras] = useState('')
  const [colores, setColores] = useState('')
  const [interferencia, setInterferencia] = useState('')
  const [erroresPalabras, setErroresPalabras] = useState('')
  const [erroresColores, setErroresColores] = useState('')
  const [erroresInterferencia, setErroresInterferencia] = useState('')

  const P = palabras !== '' ? Number(palabras) : null
  const C = colores !== '' ? Number(colores) : null
  const PC = interferencia !== '' ? Number(interferencia) : null

  /** Stroop interference index: PC_obs - (P×C)/(P+C) */
  const interferenceIndex =
    P !== null && C !== null && PC !== null && P + C > 0
      ? PC - (P * C) / (P + C)
      : null

  const raw = {
    palabras: P,
    colores: C,
    interferencia: PC,
    errores_palabras: erroresPalabras !== '' ? Number(erroresPalabras) : null,
    errores_colores: erroresColores !== '' ? Number(erroresColores) : null,
    errores_interferencia: erroresInterferencia !== '' ? Number(erroresInterferencia) : null,
  }

  const isValid = P !== null && C !== null && PC !== null

  return (
    <FormBase
      testType="Stroop"
      description="Stroop Color-Word Test — 3 condiciones (Golden, 1978). Índice de interferencia calculado automáticamente."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
    >
      {/* Primary scores */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Palabras — P', sublabel: 'lectura de palabras', val: palabras, setter: setPalabras },
          { label: 'Colores — C', sublabel: 'denominación de colores', val: colores, setter: setColores },
          { label: 'Color-Palabra — PC', sublabel: 'condición interferencia', val: interferencia, setter: setInterferencia },
        ].map(({ label, sublabel, val, setter }) => (
          <div key={label}>
            <label className="block text-sm font-medium text-brand-ink mb-0.5">
              {label} <span className="text-clinical-impaired">*</span>
            </label>
            <p className="text-xs text-brand-muted mb-1">{sublabel}</p>
            <input
              type="number"
              min={0}
              max={110}
              value={val}
              onChange={e => setter(e.target.value)}
              placeholder="0"
              className="w-full text-2xl font-semibold text-center px-3 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        ))}
      </div>

      {/* Interference index */}
      <div className="rounded-input border border-brand-mid/30 bg-brand-bg px-4 py-3">
        <p className="text-xs text-brand-muted mb-1 font-mono">
          Índice de interferencia = PC − (P×C)/(P+C)
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-brand-ink">Índice de interferencia:</span>
          {interferenceIndex !== null ? (
            <span
              className={`text-xl font-semibold ${
                interferenceIndex >= 0 ? 'text-clinical-normal' : 'text-clinical-impaired'
              }`}
            >
              {interferenceIndex.toFixed(2)}
            </span>
          ) : (
            <span className="text-brand-muted text-sm">— (completar P, C y PC)</span>
          )}
        </div>
        {interferenceIndex !== null && (
          <p className="text-xs text-brand-muted mt-1">
            {interferenceIndex >= 0
              ? '✓ Valor positivo → buena capacidad de inhibición'
              : '⚠ Valor negativo → efecto de interferencia elevado'}
          </p>
        )}
      </div>

      {/* Error counts (optional) */}
      <div>
        <p className="text-sm font-medium text-brand-ink mb-2">
          Errores <span className="text-brand-muted font-normal">(opcional)</span>
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Errores P', val: erroresPalabras, setter: setErroresPalabras },
            { label: 'Errores C', val: erroresColores, setter: setErroresColores },
            { label: 'Errores PC', val: erroresInterferencia, setter: setErroresInterferencia },
          ].map(({ label, val, setter }) => (
            <div key={label}>
              <label className="block text-xs text-brand-muted mb-1">{label}</label>
              <input
                type="number"
                min={0}
                max={30}
                value={val}
                onChange={e => setter(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
            </div>
          ))}
        </div>
      </div>
    </FormBase>
  )
}
