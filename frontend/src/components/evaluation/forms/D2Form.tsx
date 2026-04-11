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

// Test d2-R (Brickenkamp, Zillmer & Lazo, 2012)
// 14 líneas de ~47 caracteres. Estímulo objetivo: 'd' con exactamente 2 trazos (cualquier posición).
// Clinician records per line: TR (items intentados), O (omisiones), C (comisiones)
//
// Scores computed:
//   TOT = ΣTR - ΣO - ΣC           → rendimiento neto
//   CON = ΣTR - ΣO - 2×ΣC         → índice de concentración (penaliza doble comisiones)
//   VA  = max(TR) - min(TR)        → variación (consistencia)

const NUM_LINES = 14

interface LineData {
  tr: string
  o: string
  c: string
}

const emptyLine = (): LineData => ({ tr: '', o: '', c: '' })

function numOf(v: string) {
  const n = parseInt(v, 10)
  return isNaN(n) || n < 0 ? 0 : n
}

function ColorBadge({ value, label }: { value: number; label: string }) {
  const color =
    value >= 150 ? 'bg-green-100 text-green-700' :
    value >= 100 ? 'bg-blue-50 text-blue-700' :
    value >= 60  ? 'bg-yellow-50 text-yellow-700' :
                   'bg-red-50 text-red-700'
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col items-center gap-0.5 ${color} border-current/10`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-[11px] font-medium opacity-70">{label}</span>
    </div>
  )
}

export default function D2Form({ mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [lines, setLines] = useState<LineData[]>(() => {
    const stored = initialData?.lineas as Array<{ tr: number; o: number; c: number }> | undefined
    if (!stored) return Array.from({ length: NUM_LINES }, emptyLine)
    return stored.map(l => ({ tr: String(l.tr), o: String(l.o), c: String(l.c) }))
  })

  const updateLine = (idx: number, field: keyof LineData, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const parsed = lines.map(l => ({
    tr: numOf(l.tr),
    o: numOf(l.o),
    c: numOf(l.c),
  }))

  const totalTR = parsed.reduce((s, l) => s + l.tr, 0)
  const totalO  = parsed.reduce((s, l) => s + l.o, 0)
  const totalC  = parsed.reduce((s, l) => s + l.c, 0)

  const trsWithData = parsed.filter(l => l.tr > 0).map(l => l.tr)
  const trPlus  = trsWithData.length ? Math.max(...trsWithData) : 0
  const trMinus = trsWithData.length ? Math.min(...trsWithData) : 0
  const va      = trPlus - trMinus

  const tot = totalTR - totalO - totalC
  const con = totalTR - totalO - 2 * totalC

  const isValid = parsed.some(l => l.tr > 0)

  const raw: Record<string, unknown> = {
    lineas: parsed,
    total_tr: totalTR,
    total_o: totalO,
    total_c: totalC,
    tot,
    indice_concentracion: con,
    tr_plus: trPlus,
    tr_minus: trMinus,
    variacion: va,
  }

  return (
    <FormBase
      testType="Test-d2-R"
      description="Test de Atención d2 Revisado (Brickenkamp, Zillmer & Lazo, 2012). Mide velocidad de procesamiento, atención selectiva y concentración. 14 líneas de símbolos; el paciente marca las 'd' con dos trazos."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      {/* Summary scores */}
      <div className="grid grid-cols-3 gap-3">
        <ColorBadge value={tot} label="TOT" />
        <ColorBadge value={con} label="CON (IC)" />
        <div className="rounded-xl border border-gray-100 px-4 py-3 flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold text-[#270D38]">{va}</span>
          <span className="text-[11px] font-medium text-gray-400">VA (variación)</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-[#f8f7f5] rounded-lg px-4 py-3 text-[11px] text-gray-500 space-y-1">
        <p><strong className="text-[#270D38]">TR</strong> — Total de respuestas (marcas realizadas) en la línea.</p>
        <p><strong className="text-[#270D38]">O</strong> — Omisiones: objetivos no marcados.</p>
        <p><strong className="text-[#270D38]">C</strong> — Comisiones: no-objetivos marcados incorrectamente.</p>
        <p className="pt-1 text-gray-400">
          TOT = ΣTR − ΣO − ΣC · CON = ΣTR − ΣO − 2×ΣC · VA = TR<sub>+</sub> − TR<sub>−</sub>
        </p>
      </div>

      {/* Line table */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f5f3ff] text-[11px] text-[#270D38] font-semibold uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left w-10">Línea</th>
              <th className="px-3 py-2.5 text-center">TR</th>
              <th className="px-3 py-2.5 text-center">O</th>
              <th className="px-3 py-2.5 text-center">C</th>
              <th className="px-3 py-2.5 text-right text-[10px] text-gray-400 font-normal">Neto</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const p = parsed[i]
              const neto = p.tr - p.o - p.c
              const hasData = p.tr > 0
              return (
                <tr key={i} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-3 py-1.5 text-[11px] font-medium text-gray-400">{i + 1}</td>
                  {(['tr', 'o', 'c'] as const).map(field => (
                    <td key={field} className="px-1.5 py-1">
                      <input
                        type="number"
                        min={0}
                        max={field === 'tr' ? 58 : 58}
                        value={line[field]}
                        onChange={e => updateLine(i, field, e.target.value)}
                        placeholder="—"
                        className="w-full text-center text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-[#9839D1] focus:ring-1 focus:ring-[#9839D1]/30 transition-colors"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right">
                    {hasData ? (
                      <span className={`text-sm font-semibold ${neto >= 0 ? 'text-[#270D38]' : 'text-red-500'}`}>
                        {neto}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-[#f5f3ff] font-semibold text-[#270D38]">
              <td className="px-3 py-2.5 text-[11px] uppercase tracking-wide">Total</td>
              <td className="px-3 py-2.5 text-center text-sm">{totalTR}</td>
              <td className="px-3 py-2.5 text-center text-sm">{totalO}</td>
              <td className="px-3 py-2.5 text-center text-sm">{totalC}</td>
              <td className="px-3 py-2.5 text-right text-sm">{tot}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* TR+/TR- detail */}
      {trsWithData.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg border border-gray-100 py-2.5">
            <div className="text-xs text-gray-400 mb-0.5">TR<sub>+</sub></div>
            <div className="text-xl font-bold text-[#270D38]">{trPlus}</div>
          </div>
          <div className="rounded-lg border border-gray-100 py-2.5">
            <div className="text-xs text-gray-400 mb-0.5">TR<sub>−</sub></div>
            <div className="text-xl font-bold text-[#270D38]">{trMinus}</div>
          </div>
          <div className="rounded-lg border border-gray-100 py-2.5">
            <div className="text-xs text-gray-400 mb-0.5">VA</div>
            <div className="text-xl font-bold text-[#270D38]">{va}</div>
          </div>
        </div>
      )}
    </FormBase>
  )
}
