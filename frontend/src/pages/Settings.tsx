import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6 text-brand-mid" />
        <h1 className="text-2xl font-semibold text-brand-ink">Configuración</h1>
      </div>
      <div className="bg-white rounded-card shadow-card p-6">
        <p className="text-brand-muted text-sm">Configuración en construcción…</p>
      </div>
    </div>
  )
}
