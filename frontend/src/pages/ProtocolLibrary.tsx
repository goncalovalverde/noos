import { useState, useEffect } from 'react'
import { ClipboardList, Plus, X, Trash2, GripVertical, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuthStore } from '@/store/auth'
import { protocolsApi, type Protocol, type ProtocolTestIn } from '@/api/protocols'
import { extractApiError } from '@/utils/apiError'

const ALL_TEST_TYPES = [
  'TMT-A', 'TMT-B', 'TAVEC', 'Fluidez-FAS', 'Rey-Copia', 'Rey-Memoria',
  'Dígitos-Directos', 'Dígitos-Inversos', 'Letras-Números', 'Aritmética',
  'Clave-Números', 'Búsqueda-Símbolos', 'Semejanzas', 'Vocabulario',
  'Matrices', 'Cubos', 'Torre-Londres', 'Stroop', 'FAS-Verbal',
]

const CATEGORY_SUGGESTIONS = ['Rastreio', 'Memoria', 'Atención', 'Completo', 'Personalizado']

const CATEGORY_COLORS: Record<string, string> = {
  Rastreio: 'bg-blue-100 text-blue-800',
  Memoria: 'bg-green-100 text-green-800',
  Atención: 'bg-pink-100 text-pink-800',
  Completo: 'bg-purple-100 text-purple-700',
  Personalizado: 'bg-yellow-100 text-yellow-800',
}
const DEFAULT_BADGE = 'bg-gray-100 text-gray-600'

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  const cls = CATEGORY_COLORS[category] ?? DEFAULT_BADGE
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>
      {category}
    </span>
  )
}

// ─── Sortable Test Item ─────────────────────────────────────────────────────

function SortableTestItem({ id, test, onRemove }: { id: string; test: ProtocolTestIn; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 bg-white"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-6 h-6 rounded flex items-center justify-center bg-purple-100 text-purple-700 text-[10px] font-bold flex-shrink-0">
        {test.order}
      </span>
      <span className="flex-1 text-sm font-medium text-brand-ink">{test.test_type}</span>
      <button
        type="button"
        onClick={onRemove}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Create / Edit Modal ────────────────────────────────────────────────────

interface ModalProps {
  initial?: Protocol | null
  onSave: (data: { name: string; description: string; category: string; tests: ProtocolTestIn[]; is_public: boolean; allow_customization: boolean }) => Promise<void>
  onClose: () => void
}

function ProtocolModal({ initial, onSave, onClose }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [tests, setTests] = useState<ProtocolTestIn[]>(
    initial?.tests.map(t => ({ test_type: t.test_type, order: t.order, default_notes: t.default_notes ?? null })) ?? []
  )
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true)
  const [allowCustomization, setAllowCustomization] = useState(initial?.allow_customization ?? true)
  const [newTestType, setNewTestType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const addTest = () => {
    if (!newTestType) return
    setTests(prev => [...prev, { test_type: newTestType, order: prev.length + 1, default_notes: null }])
    setNewTestType('')
  }

  const removeTest = (idx: number) => {
    setTests(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, order: i + 1 })))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTests(prev => {
      const oldIdx = prev.findIndex((_, i) => `test-${i}` === active.id)
      const newIdx = prev.findIndex((_, i) => `test-${i}` === over.id)
      return arrayMove(prev, oldIdx, newIdx).map((t, i) => ({ ...t, order: i + 1 }))
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), description: description.trim(), category: category.trim(), tests, is_public: isPublic, allow_customization: allowCustomization })
      onClose()
    } catch (err: unknown) {
      setError(extractApiError(err, 'Error al guardar el protocolo'))
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!initial

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/45 backdrop-blur-sm p-4">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-ink">
            {isEdit ? 'Editar Protocolo' : 'Nuevo Protocolo'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-brand-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-brand-ink mb-1">Nombre *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Batería Completa"
                className="w-full bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-brand-ink mb-1">Categoría</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                list="cat-suggestions"
                placeholder="Ej. Rastreio"
                className="w-full bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
              <datalist id="cat-suggestions">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
              {/* Pill shortcuts */}
              <div className="flex gap-1.5 flex-wrap mt-2">
                {CATEGORY_SUGGESTIONS.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setCategory(c)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      category === c
                        ? 'bg-brand-mid text-white border-brand-mid'
                        : 'border-gray-200 text-brand-muted hover:border-brand-mid hover:text-brand-mid'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-brand-ink mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Descripción breve del protocolo…"
                className="w-full bg-brand-bg border border-gray-200 rounded-input px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-mid resize-none"
              />
            </div>

            {/* Protocol settings */}
            <div>
              <label className="block text-xs font-semibold text-brand-ink mb-3">Ajustes del protocolo</label>
              <div className="space-y-3">
                {/* Toggle row: is_public */}
                <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">Visible para todos los clínicos</p>
                    <p className="text-xs text-brand-muted mt-0.5">Si está desactivado, solo tú puedes usarlo</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPublic(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${isPublic ? 'bg-brand-mid' : 'bg-gray-200'}`}
                    role="switch"
                    aria-checked={isPublic}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {/* Toggle row: allow_customization */}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">Permitir personalización por paciente</p>
                    <p className="text-xs text-brand-muted mt-0.5">Los clínicos pueden añadir o excluir tests al asignarlo</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowCustomization(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${allowCustomization ? 'bg-brand-mid' : 'bg-gray-200'}`}
                    role="switch"
                    aria-checked={allowCustomization}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${allowCustomization ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tests */}
            <div>
              <label className="block text-xs font-semibold text-brand-ink mb-2">
                Tests <span className="text-gray-400 font-normal">(arrasta para reordenar)</span>
              </label>
              {tests.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={tests.map((_, i) => `test-${i}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1 mb-3">
                      {tests.map((t, i) => (
                        <SortableTestItem
                          key={`test-${i}`}
                          id={`test-${i}`}
                          test={t}
                          onRemove={() => removeTest(i)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              <div className="flex gap-2 pt-2 border-t border-dashed border-purple-200">
                <select
                  value={newTestType}
                  onChange={e => setNewTestType(e.target.value)}
                  className="flex-1 bg-brand-bg border border-dashed border-purple-300 rounded-input px-3 py-2 text-sm text-brand-ink focus:outline-none focus:border-brand-mid focus:border-solid"
                >
                  <option value="">Seleccionar test…</option>
                  {ALL_TEST_TYPES.filter(tt => !tests.find(t => t.test_type === tt)).map(tt => (
                    <option key={tt} value={tt}>{tt}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addTest}
                  disabled={!newTestType}
                  className="flex items-center gap-1 bg-brand-mid text-white px-3 py-2 rounded-btn text-sm font-semibold disabled:opacity-40 hover:bg-brand-dark transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-input px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-brand-muted border border-gray-200 rounded-btn hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-brand-mid text-white text-sm font-semibold rounded-btn hover:bg-brand-dark disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  protocol: Protocol
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

function DetailPanel({ protocol, canManage, onEdit, onDelete, onClose }: DetailPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-100">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-brand-muted mr-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-brand-ink truncate">{protocol.name}</h3>
          {protocol.category && (
            <span className="text-xs text-brand-muted">{protocol.category}</span>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2 flex-shrink-0">
            {confirmDelete ? (
              <>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-btn text-brand-muted hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onDelete}
                  className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-btn hover:bg-red-600 font-medium"
                >
                  Confirmar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onEdit}
                  className="text-xs px-3 py-1.5 border border-purple-200 text-brand-mid rounded-btn hover:bg-purple-50 font-medium"
                >
                  Editar
                </button>
                <button
                  aria-label="Eliminar protocolo"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-btn hover:bg-red-50 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  Eliminar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Active plans warning banner */}
        {protocol.active_plans_count > 0 && (
          <div className="flex items-start gap-2.5 bg-[#fff7ed] border border-[#fed7aa] rounded-[10px] px-4 py-3 text-[12px] text-[#92400e] leading-relaxed">
            <AlertTriangle className="w-[15px] h-[15px] text-[#d97706] shrink-0 mt-0.5" />
            <span>
              <strong>Este protocolo está en uso en {protocol.active_plans_count} evaluación{protocol.active_plans_count !== 1 ? 'es' : ''} activa{protocol.active_plans_count !== 1 ? 's' : ''}.</strong>{' '}
              Los cambios aquí NO afectan a los planes de pacientes ya creados — solo a los nuevos que se creen a partir de ahora.
            </span>
          </div>
        )}
        {/* Settings summary */}
        <div className="flex gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${protocol.is_public ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${protocol.is_public ? 'bg-[#1d4ed8]' : 'bg-[#6b7280]'}`} />
            {protocol.is_public ? 'Visible para todos' : 'Solo para ti'}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${protocol.allow_customization ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${protocol.allow_customization ? 'bg-[#15803d]' : 'bg-[#6b7280]'}`} />
            {protocol.allow_customization ? 'Personalización permitida' : 'Sin personalización'}
          </span>
        </div>
        {protocol.description && (
          <p className="text-sm text-brand-muted leading-relaxed">{protocol.description}</p>
        )}

        {/* Tests list */}
        <div>
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
            Tests ({protocol.tests.length})
          </p>
          {protocol.tests.length === 0 ? (
            <p className="text-xs text-brand-muted italic">Sin tests configurados</p>
          ) : (
            <div className="space-y-1">
              {protocol.tests.map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <span className="w-6 h-6 rounded flex items-center justify-center bg-purple-100 text-purple-700 text-[10px] font-bold flex-shrink-0">
                    {t.order}
                  </span>
                  <span className="text-sm font-medium text-brand-ink">{t.test_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ProtocolLibrary() {
  const user = useAuthStore(s => s.user)
  const canManage = user?.can_manage_protocols || user?.role === 'Administrador'

  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    protocolsApi.list()
      .then(setProtocols)
      .catch(() => setError('Error al cargar los protocolos'))
      .finally(() => setLoading(false))
  }, [])

  const categories = Array.from(new Set(protocols.map(p => p.category).filter(Boolean))) as string[]

  const filtered = selectedCategory
    ? protocols.filter(p => p.category === selectedCategory)
    : protocols

  const handleCreate = async (data: { name: string; description: string; category: string; tests: ProtocolTestIn[]; is_public: boolean; allow_customization: boolean }) => {
    const created = await protocolsApi.create(data)
    setProtocols(prev => [...prev, created])
  }

  const handleUpdate = async (data: { name: string; description: string; category: string; tests: ProtocolTestIn[]; is_public: boolean; allow_customization: boolean }) => {
    if (!selectedProtocol) return
    const updated = await protocolsApi.update(selectedProtocol.id, data)
    setProtocols(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelectedProtocol(updated)
    setEditMode(false)
  }

  const handleDelete = async () => {
    if (!selectedProtocol) return
    await protocolsApi.delete(selectedProtocol.id)
    setProtocols(prev => prev.filter(p => p.id !== selectedProtocol.id))
    setSelectedProtocol(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8 gap-2 text-brand-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando protocolos…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-72 min-w-[280px] flex flex-col border-r border-gray-100 bg-white overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-brand-mid" />
              <h1 className="text-base font-semibold text-brand-ink">
                Protocolos <span className="text-brand-mid">clínicos</span>
              </h1>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                selectedCategory === null
                  ? 'bg-brand-mid text-white border-brand-mid'
                  : 'border-gray-200 text-brand-muted hover:border-brand-mid hover:text-brand-mid'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-brand-mid text-white border-brand-mid'
                    : 'border-gray-200 text-brand-muted hover:border-brand-mid hover:text-brand-mid'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* New protocol button */}
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="mx-4 my-3 flex items-center justify-center gap-1.5 bg-brand-mid text-white text-sm font-semibold px-4 py-2 rounded-btn hover:bg-brand-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Protocolo
          </button>
        )}

        {/* Protocol list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-brand-muted italic">
              {selectedCategory ? `No hay protocolos en "${selectedCategory}"` : 'No hay protocolos creados'}
            </p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedProtocol(p); setEditMode(false) }}
                className={`w-full text-left px-4 py-3 border-l-2 border-b border-b-gray-50 transition-colors hover:bg-gray-50 ${
                  selectedProtocol?.id === p.id
                    ? 'border-l-brand-mid bg-purple-50'
                    : 'border-l-transparent'
                }`}
              >
                <p className="text-sm font-semibold text-brand-ink mb-1 truncate">{p.name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryBadge category={p.category} />
                  <span className="text-xs text-brand-muted">
                    {p.tests.length} {p.tests.length === 1 ? 'test' : 'tests'}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-brand-muted mt-1 line-clamp-1">{p.description}</p>
                )}
                {/* test type chips */}
                {p.tests.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {p.tests.slice(0, 4).map((t, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {t.test_type}
                      </span>
                    ))}
                    {p.tests.length > 4 && (
                      <span className="text-[10px] text-brand-muted">+{p.tests.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel – detail or empty state */}
      <div className="flex-1 overflow-hidden">
        {selectedProtocol ? (
          <DetailPanel
            protocol={selectedProtocol}
            canManage={canManage}
            onEdit={() => setEditMode(true)}
            onDelete={handleDelete}
            onClose={() => setSelectedProtocol(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-brand-muted gap-2">
            <ChevronRight className="w-8 h-8 opacity-30" />
            <p className="text-sm">Selecciona un protocolo para ver los detalles</p>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <ProtocolModal
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit modal */}
      {editMode && selectedProtocol && (
        <ProtocolModal
          initial={selectedProtocol}
          onSave={handleUpdate}
          onClose={() => setEditMode(false)}
        />
      )}
    </div>
  )
}
