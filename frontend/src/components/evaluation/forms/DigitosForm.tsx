import { useState } from 'react'
import FormBase from './FormBase'

type DigitosTestType = 'Dígitos-Directos' | 'Dígitos-Inversos' | 'Letras-Números'

interface Props {
  testType: DigitosTestType
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip: () => void
  saving: boolean
}

const DESCRIPTIONS: Record<DigitosTestType, string> = {
  'Dígitos-Directos': 'WAIS-IV — Repetición de dígitos en orden directo (span 2–9, 2 ensayos por span)',
  'Dígitos-Inversos': 'WAIS-IV — Repetición en orden inverso (span 2–8, 2 ensayos por span)',
  'Letras-Números': 'WAIS-IV — Secuenciación de letras y números (span 2–8, 2 ensayos por span)',
}

/** Maximum span depends on subtest */
const MAX_SPAN: Record<DigitosTestType, number> = {
  'Dígitos-Directos': 9,
  'Dígitos-Inversos': 8,
  'Letras-Números': 8,
}

/** Total possible correct trials given a span_maximo (each span has 2 trials) */
function maxPossibleAciertos(spanMaximo: number, minSpan = 2): number {
  if (spanMaximo < minSpan) return 0
  return (spanMaximo - minSpan + 1) * 2
}

export default function DigitosForm({ testType, mode: _mode, onSave, onSkip, saving }: Props) {
  const [spanMaximo, setSpanMaximo] = useState('')
  const [totalAciertos, setTotalAciertos] = useState('')

  const maxSpan = MAX_SPAN[testType]
  const spanNum = Number(spanMaximo)
  const aciertosNum = Number(totalAciertos)
  const possibleMax = spanMaximo !== '' ? maxPossibleAciertos(spanNum) : null

  const raw = {
    span_maximo: spanMaximo !== '' ? spanNum : null,
    total_aciertos: totalAciertos !== '' ? aciertosNum : null,
  }

  const isValid =
    spanMaximo !== '' &&
    totalAciertos !== '' &&
    spanNum >= 2 &&
    spanNum <= maxSpan &&
    aciertosNum >= 0 &&
    aciertosNum <= 16

  return (
    <FormBase
      testType={testType}
      description={DESCRIPTIONS[testType]}
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Span máximo */}
        <div>
          <label htmlFor="digitos-span" className="block text-sm font-medium text-brand-ink mb-1">
            Span máximo alcanzado <span className="text-clinical-impaired">*</span>
          </label>
          <input
            id="digitos-span"
            type="number"
            min={2}
            max={maxSpan}
            value={spanMaximo}
            onChange={e => setSpanMaximo(e.target.value)}
            placeholder={`2–${maxSpan}`}
            className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />
          <p className="text-xs text-brand-muted mt-1">Rango: 2–{maxSpan}</p>
        </div>

        {/* Total aciertos */}
        <div>
          <label htmlFor="digitos-aciertos" className="block text-sm font-medium text-brand-ink mb-1">
            Total aciertos (ensayos correctos) <span className="text-clinical-impaired">*</span>
          </label>
          <input
            id="digitos-aciertos"
            type="number"
            min={0}
            max={16}
            value={totalAciertos}
            onChange={e => setTotalAciertos(e.target.value)}
            placeholder="0–16"
            className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />
          <p className="text-xs text-brand-muted mt-1">Máx. total posible: 16</p>
        </div>
      </div>

      {/* Live hint: max possible given span */}
      {possibleMax !== null && (
        <div className="rounded-input bg-brand-bg border border-brand-mid/20 px-4 py-2 text-sm text-brand-ink">
          Con span máximo <strong>{spanNum}</strong>, el total máximo posible es{' '}
          <strong>{possibleMax}</strong> aciertos
          {aciertosNum > possibleMax && (
            <span className="ml-2 text-clinical-impaired font-medium">
              ⚠ Total introducido supera el máximo esperado
            </span>
          )}
        </div>
      )}
    </FormBase>
  )
}
