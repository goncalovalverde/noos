import { useState } from 'react'
import { User, Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { usersApi } from '@/api/users'

const ROLE_COLORS: Record<string, string> = {
  Administrador: 'bg-purple-100 text-purple-700',
  'Neuropsicólogo': 'bg-blue-100 text-blue-700',
  Observador: 'bg-gray-100 text-gray-600',
}

export default function Profile() {
  const { user, setUser } = useAuthStore()

  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '??'

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEmail(true)
    setEmailMsg(null)
    try {
      const updated = await usersApi.updateMe({ email: email.trim() || undefined })
      setUser({ ...user!, email: updated.email ?? null })
      setEmailMsg({ type: 'ok', text: 'Email actualizado correctamente.' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setEmailMsg({ type: 'err', text: msg ?? 'Error al actualizar el email.' })
    } finally {
      setSavingEmail(false)
    }
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    setSavingPassword(true)
    try {
      await usersApi.updateMe({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ type: 'ok', text: 'Contraseña cambiada correctamente.' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPasswordMsg({ type: 'err', text: msg ?? 'Error al cambiar la contraseña.' })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-xl font-semibold text-brand-ink">Mi Perfil</h1>

      {/* Identity card */}
      <div className="bg-white rounded-card shadow-card p-6 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #9839D1, #B738F2)' }}
        >
          {initials}
        </div>
        <div>
          <p className="text-base font-semibold text-brand-ink">{user?.full_name || user?.username}</p>
          <p className="text-sm text-brand-muted">@{user?.username}</p>
          <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[user?.role ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
            {user?.role}
          </span>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-brand-mid" />
          <h2 className="text-sm font-semibold text-brand-ink">Correo electrónico</h2>
        </div>
        <form onSubmit={handleEmailSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-brand-ink mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>
          {emailMsg && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${emailMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {emailMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {emailMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingEmail}
              className="flex items-center gap-2 bg-brand-mid text-white text-sm font-medium px-5 py-2 rounded-btn hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
              Guardar email
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-brand-mid" />
          <h2 className="text-sm font-semibold text-brand-ink">Cambiar contraseña</h2>
        </div>
        <form onSubmit={handlePasswordSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-brand-ink mb-1">Contraseña actual</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-ink mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-brand-muted mt-1">Mín. 12 caracteres, mayúsculas, minúsculas, números y símbolo especial.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-ink mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className={`w-full px-3 py-2 border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid ${
                confirmPassword && confirmPassword !== newPassword ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[11px] text-red-500 mt-1">Las contraseñas no coinciden.</p>
            )}
          </div>
          {passwordMsg && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${passwordMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {passwordMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {passwordMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword || (!!confirmPassword && confirmPassword !== newPassword)}
              className="flex items-center gap-2 bg-brand-mid text-white text-sm font-medium px-5 py-2 rounded-btn hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Cambiar contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
