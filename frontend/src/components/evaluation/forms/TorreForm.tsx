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

const MIN_MOVES: Record<number, number> = {
  1: 4, 2: 4, 3: 5, 4: 5, 5: 5,
  6: 6, 7: 6, 8: 6, 9: 7, 10: 7,
}

const PROBLEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export default function TorreForm({ mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [movements, setMovements] = useState<Record<number, string>>(() => {
    const mc = initialData?.movement_counts as (number | null)[] | undefined
    return Object.fromEntries(PROBLEMS.map(p => [p, mc?.[p - 1] != null ? String(mc![p - 1]) : '']))
  })
  const [times, setTimes] = useState<Record<number, string>>(() => {
    const ts = initialData?.time_seconds as (number | null)[] | undefined
    return Object.fromEntries(PROBLEMS.map(p => [p, ts?.[p - 1] != null ? String(ts![p - 1]) : '']))
  })

  const setMovement = (problem: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMovements(prev => ({ ...prev, [problem]: e.target.value }))

  const setTime = (problem: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setTimes(prev => ({ ...prev, [problem]: e.target.value }))

  const movementCounts = PROBLEMS.map(p => (movements[p] !== '' ? Number(movements[p]) : null))
  const timeSecs = PROBLEMS.map(p => (times[p] !== '' ? Number(times[p]) : null))

  const penalty = PROBLEMS.reduce((acc, p) => {
    const mv = movements[p] !== '' ? Number(movements[p]) : null
    if (mv !== null && mv > MIN_MOVES[p]) return acc + (mv - MIN_MOVES[p])
    return acc
  }, 0)

  const isValid = PROBLEMS.every(p => {
    const mv = movements[p]
    return mv !== '' && Number(mv) >= MIN_MOVES[p] && Number(mv) <= 20
  })

  const raw = {
    movement_counts: movementCounts,
    time_seconds: timeSecs,
  }

  return (
    <FormBase
      testType="Torre-Londres"
      description="Torre de Londres — 10 problemas de planificación (mín. movimientos por problema)"
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-3 font-medium text-brand-ink w-20">Problema</th>
              <th className="text-center py-2 px-2 font-medium text-brand-ink w-16">Mín</th>
              <th className="text-left py-2 px-2 font-medium text-brand-ink">
                Movimientos <span className="text-clinical-impaired">*</span>
              </th>
              <th className="text-left py-2 pl-3 font-medium text-brand-muted">
                Tiempo (seg)
              </th>
            </tr>
          </thead>
          <tbody>
            {PROBLEMS.map(p => {
              const mv = movements[p]
              const mvNum = mv !== '' ? Number(mv) : null
              const belowMin = mvNum !== null && mvNum < MIN_MOVES[p]
              const extraMoves = mvNum !== null && mvNum > MIN_MOVES[p] ? mvNum - MIN_MOVES[p] : 0

              return (
                <tr key={p} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-brand-dark">{p}</td>
                  <td className="py-1.5 px-2 text-center text-brand-muted">{MIN_MOVES[p]}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={MIN_MOVES[p]}
                        max={20}
                        value={mv}
                        onChange={setMovement(p)}
                        placeholder={String(MIN_MOVES[p])}
                        className={`w-20 px-2 py-1.5 border rounded-input text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-mid ${
                          belowMin ? 'border-clinical-impaired bg-red-50' : 'border-gray-200'
                        }`}
                      />
                      {extraMoves > 0 && (
                        <span className="text-xs text-brand-muted">+{extraMoves}</span>
                      )}
                    </div>
                    {belowMin && (
                      <p className="text-xs text-clinical-impaired mt-0.5">
                        Mín: {MIN_MOVES[p]}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 pl-3">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={times[p]}
                      onChange={setTime(p)}
                      placeholder="—"
                      className="w-20 px-2 py-1.5 border border-gray-200 rounded-input text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-mid"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Penalty summary */}
      <div className="rounded-input bg-brand-bg border border-brand-mid/20 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-brand-ink">Penalización total</span>
        <span className="text-lg font-semibold text-brand-dark">
          {penalty} movimiento{penalty !== 1 ? 's' : ''} extra
        </span>
      </div>
    </FormBase>
  )
}
