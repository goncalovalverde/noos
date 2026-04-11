import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

// BTA — 10 sequences of increasing length (4–13 items)
// Part N: patient counts only numbers → 1pt per correct sequence (max 10)
// Part L: patient counts only letters → 1pt per correct sequence (max 10)
// Total: 0–20

const SEQ_LENGTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

function SeqRow({
  label,
  items,
  onChange,
}: {
  label: string
  items: boolean[]
  onChange: (idx: number, val: boolean) => void
}) {
  const score = items.filter(Boolean).length
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#270D38] uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
          score === 10 ? 'bg-green-100 text-green-700' :
          score >= 7   ? 'bg-purple-50 text-[#9839D1]' :
                         'bg-gray-100 text-gray-500'
        }`}>
          {score} / 10
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {items.map((checked, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i, !checked)}
            title={`Secuencia ${i + 1} (${SEQ_LENGTHS[i]} elementos)`}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
              checked
                ? 'border-[#9839D1] bg-[#9839D1] text-white'
                : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
            }`}
          >
            <span>{i + 1}</span>
            <span className={`text-[9px] ${checked ? 'text-white/70' : 'text-gray-300'}`}>
              {SEQ_LENGTHS[i]}el
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BtaForm({ mode: _mode, onSave, onSkip, saving }: Props) {
  const [seqN, setSeqN] = useState<boolean[]>(Array(10).fill(false))
  const [seqL, setSeqL] = useState<boolean[]>(Array(10).fill(false))

  const puntuacionN = seqN.filter(Boolean).length
  const puntuacionL = seqL.filter(Boolean).length
  const total = puntuacionN + puntuacionL

  const handleN = (idx: number, val: boolean) =>
    setSeqN(prev => prev.map((v, i) => (i === idx ? val : v)))
  const handleL = (idx: number, val: boolean) =>
    setSeqL(prev => prev.map((v, i) => (i === idx ? val : v)))

  const raw: Record<string, unknown> = {
    n_secuencias: seqN.map(v => (v ? 1 : 0)),
    l_secuencias: seqL.map(v => (v ? 1 : 0)),
    puntuacion_n: puntuacionN,
    puntuacion_l: puntuacionL,
    total,
  }

  return (
    <FormBase
      testType="BTA"
      description="Breve Test de Atención (Schretlen, 1997). Se leen 10 secuencias de letras y números. El paciente cuenta sólo los números (Parte N) o sólo las letras (Parte L)."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={true}
    >
      {/* Live total */}
      <div className="flex items-center justify-between bg-[#faf5ff] border border-[#ede9fe] rounded-xl px-4 py-3 -mt-1">
        <div>
          <span className="text-sm font-medium text-[#270D38]">Puntuación total</span>
          <p className="text-[11px] text-gray-400 mt-0.5">Parte N + Parte L</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${
            total >= 18 ? 'text-green-600' :
            total >= 14 ? 'text-yellow-600' :
            total >= 10 ? 'text-orange-600' : 'text-red-600'
          }`}>{total}</span>
          <span className="text-base text-gray-400">/ 20</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-[#f8f7f5] rounded-lg px-4 py-3 text-[11px] text-gray-500 space-y-1">
        <p><strong className="text-[#270D38]">Administración:</strong> Leer cada secuencia en voz alta (1 elemento/segundo). Marcar ✓ si el recuento del paciente es correcto.</p>
        <p><strong className="text-[#270D38]">Parte N:</strong> «Cuente sólo los <em>números</em> que escuche» · <strong className="text-[#270D38]">Parte L:</strong> «Cuente sólo las <em>letras</em> que escuche»</p>
      </div>

      {/* Part N */}
      <div className="rounded-xl border border-gray-100 p-4">
        <SeqRow label="Parte N — Contar números" items={seqN} onChange={handleN} />
      </div>

      {/* Part L */}
      <div className="rounded-xl border border-gray-100 p-4">
        <SeqRow label="Parte L — Contar letras" items={seqL} onChange={handleL} />
      </div>

      {/* Subtotals reference */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border border-gray-100 py-2.5">
          <div className="text-xs text-gray-400 mb-0.5">Parte N</div>
          <div className="text-xl font-bold text-[#270D38]">{puntuacionN}<span className="text-sm font-normal text-gray-400">/10</span></div>
        </div>
        <div className="rounded-lg border border-gray-100 py-2.5">
          <div className="text-xs text-gray-400 mb-0.5">Parte L</div>
          <div className="text-xl font-bold text-[#270D38]">{puntuacionL}<span className="text-sm font-normal text-gray-400">/10</span></div>
        </div>
      </div>
    </FormBase>
  )
}
