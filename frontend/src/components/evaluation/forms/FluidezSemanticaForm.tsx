import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

export default function FluidezSemanticaForm({ mode: _mode, onSave, onSkip, saving }: Props) {
  const [animales, setAnimales] = useState('')
  const [frutas, setFrutas] = useState('')
  const [libreCategoria, setLibreCategoria] = useState('')
  const [libreNombre, setLibreNombre] = useState('')

  const raw = {
    animales: animales !== '' ? Number(animales) : null,
    frutas: frutas !== '' ? Number(frutas) : null,
    categoria_libre: libreCategoria !== '' ? Number(libreCategoria) : null,
    nombre_categoria_libre: libreNombre || null,
  }

  const isValid = animales !== '' && Number(animales) >= 0

  return (
    <FormBase
      testType="Fluidez-Semantica"
      description="Fluidez verbal semántica — número de palabras en 60 segundos por categoría. La norma NEURONORMA se aplica sobre animales."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={isValid}
    >
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="fs-animales" className="block text-sm font-medium text-brand-ink mb-1">
            Animales (60 seg) <span className="text-clinical-impaired">*</span>
            <span className="text-xs text-brand-muted font-normal ml-2">— usado para el cálculo normativo</span>
          </label>
          <input
            id="fs-animales"
            type="number"
            min={0}
            max={60}
            value={animales}
            onChange={e => setAnimales(e.target.value)}
            placeholder="ej. 18"
            className="w-full text-2xl font-semibold px-4 py-3 border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Frutas (60 seg) <span className="text-brand-muted font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={frutas}
              onChange={e => setFrutas(e.target.value)}
              placeholder="ej. 14"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Categoría libre <span className="text-brand-muted font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={libreCategoria}
              onChange={e => setLibreCategoria(e.target.value)}
              placeholder="ej. 12"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-ink mb-1">
            Nombre de categoría libre <span className="text-brand-muted font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={libreNombre}
            onChange={e => setLibreNombre(e.target.value)}
            placeholder="ej. Profesiones"
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
          />
        </div>
      </div>
    </FormBase>
  )
}
