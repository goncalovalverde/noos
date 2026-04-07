import { ClipboardList } from 'lucide-react'

export default function ProtocolLibrary() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-6 h-6 text-brand-mid" />
        <h1 className="text-2xl font-semibold text-brand-ink">Protocolos</h1>
      </div>
      <div className="bg-white rounded-card shadow-card p-6">
        <p className="text-brand-muted text-sm">Biblioteca de protocolos en construcción…</p>
      </div>
    </div>
  )
}
