import { useState } from 'react'
import { ChevronRight, SkipForward } from 'lucide-react'

interface QualData {
  observaciones: string
  checklist: Record<string, boolean>
}

interface Props {
  testType: string
  description?: string
  children: React.ReactNode
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
  rawData: Record<string, unknown>
  isValid?: boolean
}

const CHECKLIST_ITEMS = [
  { key: 'comprension', label: 'Dificultades de comprensión' },
  { key: 'fatiga', label: 'Fatiga observada' },
  { key: 'ansiedad', label: 'Ansiedad elevada' },
  { key: 'motivacion', label: 'Baja motivación' },
  { key: 'interrupciones', label: 'Interrupciones durante el test' },
]

export default function FormBase({ testType, description, children, onSave, onSkip, saving, rawData, isValid = true }: Props) {
  const [observaciones, setObservaciones] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  const handleSave = () => {
    onSave(rawData, { observaciones, checklist })
  }

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      {/* Test header */}
      <div className="bg-brand-dark text-white px-6 py-5">
        <h2 className="text-xl font-semibold">{testType}</h2>
        {description && <p className="text-white/70 text-sm mt-1">{description}</p>}
      </div>

      {/* Form fields */}
      <div className="p-6 space-y-5">
        {children}

        {/* Observations */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-brand-ink mb-3">Observaciones clínicas</h3>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Observaciones del proceso clínico…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />

          <div className="mt-3 space-y-2">
            {CHECKLIST_ITEMS.map(item => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist[item.key] ?? false}
                  onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  className="w-4 h-4 rounded accent-brand-mid"
                />
                <span className="text-sm text-brand-ink">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-brand-bg">
        {onSkip ? (
          <button
            onClick={onSkip}
            className="flex items-center gap-2 text-sm text-brand-muted hover:text-brand-ink border border-gray-200 bg-white px-4 py-2 rounded-btn transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Omitir este test
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={handleSave}
          disabled={saving || !isValid}
          className="flex items-center gap-2 bg-brand-mid text-white text-sm font-medium px-6 py-2 rounded-btn hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar y continuar'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
