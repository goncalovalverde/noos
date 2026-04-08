import { useState, useEffect } from 'react'
import {
  UserPlus, Pencil, Trash2, Eye, EyeOff, X, ShieldAlert,
} from 'lucide-react'
import { usersApi, type UserOut, type UserCreate, type UserUpdate } from '@/api/users'
import { useAuthStore } from '@/store/auth'
import { extractApiError } from '@/utils/apiError'

const ROLES = ['Administrador', 'Neuropsicólogo', 'Observador'] as const

function formatLastLogin(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return `Hoy, ${timeStr}`
  if (diffDays === 1) return `Ayer, ${timeStr}`
  if (diffDays < 7) return `Hace ${diffDays} días`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 2) return 'Hace 1 mes'
  return `Hace ${diffMonths} meses`
}

function RoleBadge({ role }: { role: string }) {
  const cls =
    role === 'Administrador'
      ? 'bg-purple-100 text-purple-700'
      : role === 'Neuropsicólogo'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {role}
    </span>
  )
}

function UserInitials({ name, username }: { name?: string | null; username: string }) {
  const label = name ?? username
  const initials = label
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div className="w-9 h-9 rounded-full bg-brand-mid flex items-center justify-content-center shrink-0 flex items-center justify-center">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  )
}

interface UserFormState {
  username: string
  password: string
  full_name: string
  email: string
  role: string
  can_manage_protocols: boolean
}

const EMPTY_FORM: UserFormState = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  role: 'Neuropsicólogo',
  can_manage_protocols: false,
}

export default function Settings() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<UserOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserOut | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    usersApi
      .list()
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(user: UserOut) {
    setEditingUser(user)
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      role: user.role,
      can_manage_protocols:
        user.role === 'Administrador' ? true : user.can_manage_protocols,
    })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUser(null)
  }

  function handleRoleChange(role: string) {
    setForm((f) => ({
      ...f,
      role,
      can_manage_protocols: role === 'Administrador' ? true : f.can_manage_protocols,
    }))
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      if (editingUser) {
        const update: UserUpdate = {
          full_name: form.full_name || undefined,
          email: form.email || undefined,
          role: form.role,
          can_manage_protocols: form.can_manage_protocols,
        }
        const updated = await usersApi.update(editingUser.id, update)
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      } else {
        const create: UserCreate = {
          username: form.username,
          password: form.password,
          full_name: form.full_name || undefined,
          email: form.email || undefined,
          role: form.role,
          can_manage_protocols: form.can_manage_protocols,
        }
        const created = await usersApi.create(create)
        setUsers((prev) => [...prev, created])
      }
      closeModal()
    } catch (err: unknown) {
      setError(extractApiError(err, 'Error al guardar usuario'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleProtocols(user: UserOut) {
    const updated = await usersApi.update(user.id, {
      can_manage_protocols: !user.can_manage_protocols,
    })
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  async function handleDelete(id: string) {
    await usersApi.delete(id)
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setDeleteConfirm(null)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-brand-muted">Cargando usuarios…</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-semibold text-brand-ink">Configuración</h1>
        {currentUser?.role === 'Administrador' && (
          <button
            onClick={openCreate}
            className="ml-auto flex items-center gap-2 bg-brand-mid text-white rounded-btn px-5 py-2 text-sm font-semibold hover:bg-brand-dark transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Admin note */}
      <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-card px-4 py-3 mb-5 text-sm text-purple-700">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>
          Esta sección es exclusiva para <strong>Administradores</strong>. Los cambios afectan
          de forma inmediata a los accesos de los usuarios.
        </span>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {/* Table head */}
        <div className="grid grid-cols-[2fr_1fr_1.4fr_1.4fr_1fr_80px] bg-brand-dark text-white">
          {['Usuario', 'Rol', 'Gestión Protocolos', 'Estado', 'Último acceso', ''].map((h) => (
            <div key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {users.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[2fr_1fr_1.4fr_1.4fr_1fr_80px] border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
          >
            {/* User info */}
            <div className="px-4 py-3 flex items-center gap-3">
              <UserInitials name={user.full_name} username={user.username} />
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  {user.full_name ?? user.username}
                </p>
                <p className="text-xs text-brand-muted">@{user.username}</p>
              </div>
            </div>

            {/* Role */}
            <div className="px-4 py-3 flex items-center">
              <RoleBadge role={user.role} />
            </div>

            {/* can_manage_protocols toggle */}
            <div className="px-4 py-3 flex items-center gap-2">
              {user.role === 'Administrador' ? (
                <span className="text-xs italic text-gray-300">Incluido</span>
              ) : (
                <>
                  <button
                    aria-label="Gestión Protocolos"
                    onClick={() => handleToggleProtocols(user)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      user.can_manage_protocols ? 'bg-brand-mid' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                        user.can_manage_protocols ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-xs font-medium ${
                      user.can_manage_protocols ? 'text-brand-mid' : 'text-gray-400'
                    }`}
                  >
                    {user.can_manage_protocols ? 'Sí' : 'No'}
                  </span>
                </>
              )}
            </div>

            {/* Status */}
            <div className="px-4 py-3 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  user.is_active ? 'bg-green-400' : 'bg-gray-300'
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  user.is_active ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {user.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {/* Last login */}
            <div className="px-4 py-3 flex items-center text-xs text-brand-muted">
              {user.last_login ? formatLastLogin(user.last_login) : '—'}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 flex items-center gap-1">
              <button
                aria-label="Editar"
                onClick={() => openEdit(user)}
                className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:border-purple-300 hover:text-brand-mid transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              {/* No delete for own account */}
              {currentUser?.id !== user.id && (
                <>
                  {deleteConfirm === user.id ? (
                    <button
                      aria-label="Confirmar eliminación"
                      onClick={() => handleDelete(user.id)}
                      className="w-7 h-7 rounded-md border border-red-300 bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      aria-label="Eliminar"
                      onClick={() => setDeleteConfirm(user.id)}
                      className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <p className="px-4 py-8 text-center text-brand-muted text-sm">
            No hay usuarios registrados.
          </p>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-brand-dark/45 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-card p-8 w-[460px] shadow-2xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-brand-ink">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  {editingUser
                    ? 'Modifica los datos del usuario'
                    : 'Rellena los datos para crear un nuevo usuario'}
                </p>
              </div>
              <button
                onClick={closeModal}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid/30"
                  placeholder="Dra. Ana García"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1">
                  Nombre de usuario *
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  readOnly={!!editingUser}
                  className={`w-full border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid/30 ${
                    editingUser ? 'bg-gray-50 text-gray-400' : ''
                  }`}
                  placeholder="dra.garcia"
                  minLength={3}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid/30"
                  placeholder="ana@clinica.es"
                />
              </div>

              {/* Password (create only) */}
              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1">
                    Contraseña *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full border border-gray-200 rounded-input px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid/30"
                      placeholder="Mín. 12 chars, mayús., número, símbolo"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Role */}
              <div>
                <label
                  htmlFor="role-select"
                  className="block text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1"
                >
                  Rol
                </label>
                <select
                  id="role-select"
                  aria-label="Rol"
                  value={form.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid/30"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* can_manage_protocols */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-brand-ink">Gestión de protocolos</p>
                  <p className="text-xs text-brand-muted">
                    Puede crear, editar y eliminar protocolos
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Gestión de protocolos"
                    checked={form.role === 'Administrador' ? true : form.can_manage_protocols}
                    disabled={form.role === 'Administrador'}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, can_manage_protocols: e.target.checked }))
                    }
                    className="w-4 h-4 accent-brand-mid"
                  />
                </label>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded-input px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="border border-gray-200 text-brand-muted rounded-btn px-5 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand-mid text-white rounded-btn px-5 py-2 text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
