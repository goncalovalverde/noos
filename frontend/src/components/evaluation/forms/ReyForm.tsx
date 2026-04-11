import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  testType: 'Rey-Copia' | 'Rey-Memoria'
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
  initialData?: Record<string, unknown>
  initialQual?: Record<string, unknown>
  saveLabel?: string
}

const DESCRIPTIONS: Record<string, string> = {
  'Rey-Copia': 'Copia de la figura compleja de Rey-Osterrieth (máx. 36 puntos, 18 elementos × 2 pts)',
  'Rey-Memoria': 'Reproducción de memoria de la figura compleja (máx. 36 puntos)',
}

const ESTRATEGIA_OPTIONS = [
  { value: '', label: '— Sin registrar —' },
  { value: 'I', label: 'I - Configuración global' },
  { value: 'II', label: 'II - Con detalle' },
  { value: 'III', label: 'III - Por partes' },
  { value: 'IV', label: 'IV - Yuxtaposición' },
  { value: 'V', label: 'V - Contaminación' },
]

export default function ReyForm({ testType, mode: _mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const [puntuacion, setPuntuacion] = useState(() => initialData?.puntuacion_bruta != null ? String(initialData.puntuacion_bruta) : '')
  const [tiempoEjecucion, setTiempoEjecucion] = useState(() => initialData?.tiempo_segundos != null ? String(initialData.tiempo_segundos) : '')
  const [tiempoDemora, setTiempoDemora] = useState(() => initialData?.tiempo_demora_minutos != null ? String(initialData.tiempo_demora_minutos) : '')
  const [estrategia, setEstrategia] = useState(() => initialData?.estrategia != null ? String(initialData.estrategia) : '')

  const isCopia = testType === 'Rey-Copia'

  const raw: Record<string, unknown> = {
    puntuacion_bruta: puntuacion !== '' ? Number(puntuacion) : null,
    tiempo_segundos: tiempoEjecucion !== '' ? Number(tiempoEjecucion) : null,
    tiempo_demora_minutos: tiempoDemora !== '' ? Number(tiempoDemora) : null,
    estrategia: estrategia || null,
  }

  const isValid = puntuacion !== '' && Number(puntuacion) >= 0 && Number(puntuacion) <= 36

  return (
    <FormBase
      testType={testType}
      description={DESCRIPTIONS[testType]}
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
      initialQual={initialQual}
      saveLabel={saveLabel}
    >
      {/* Primary score */}
      <div>
        <label htmlFor="rey-puntuacion" className="block text-sm font-medium text-brand-ink mb-1">
          Puntuación (0–36) <span className="text-clinical-impaired">*</span>
        </label>
        <input
          id="rey-puntuacion"
          type="number"
          min={0}
          max={36}
          step={0.5}
          value={puntuacion}
          onChange={e => setPuntuacion(e.target.value)}
          placeholder="ej. 28"
          className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Copy: execution time */}
        {isCopia && (
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Tiempo de ejecución (seg){' '}
              <span className="text-brand-muted font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              max={600}
              value={tiempoEjecucion}
              onChange={e => setTiempoEjecucion(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        )}

        {/* Memory: delay time */}
        {!isCopia && (
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Tiempo de demora (min){' '}
              <span className="text-brand-muted font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={tiempoDemora}
              onChange={e => setTiempoDemora(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        )}

        {/* Strategy */}
        <div>
          <label className="block text-sm font-medium text-brand-ink mb-1">
            Estrategia de copia{' '}
            <span className="text-brand-muted font-normal">(opcional)</span>
          </label>
          <select
            value={estrategia}
            onChange={e => setEstrategia(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid bg-white"
          >
            {ESTRATEGIA_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </FormBase>
  )
}
