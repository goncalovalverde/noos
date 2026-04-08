import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts'
import {
  getOverviewStats, getRecentPlans, getClassificationDistribution,
  type OverviewStats, type RecentPlan, type ClassificationCount,
} from '@/api/stats'
import { useAuthStore } from '@/store/auth'

const CLASSIFICATION_COLORS: Record<string, string> = {
  'Superior': '#16a34a',
  'Normal': '#2563eb',
  'Limítrofe': '#d97706',
  'Deficitario': '#dc2626',
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed:  { label: 'Completado', cls: 'bg-[#dcfce7] text-[#15803d]' },
  active:     { label: 'En curso',   cls: 'bg-[#dbeafe] text-[#1d4ed8]' },
  draft:      { label: 'Borrador',   cls: 'bg-[#f3f4f6] text-[#6b7280]' },
  abandoned:  { label: 'Abandonado', cls: 'bg-[#fee2e2] text-[#b91c1c]' },
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [recentPlans, setRecentPlans] = useState<RecentPlan[]>([])
  const [distribution, setDistribution] = useState<ClassificationCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getOverviewStats(), getRecentPlans(), getClassificationDistribution()])
      .then(([o, p, d]) => {
        setOverview(o)
        setRecentPlans(p)
        setDistribution(d)
      })
      .finally(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const displayName = user?.full_name || user?.username || 'usuario'
  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const stats = [
    { label: 'Pacientes activos',          value: overview?.total_patients,       accent: false },
    { label: 'Tests esta semana',           value: overview?.tests_this_week,      accent: false },
    { label: 'Protocolos activos',          value: overview?.active_protocols,     accent: false },
    { label: 'Evaluaciones completadas',    value: overview?.completed_this_month, accent: true  },
  ]

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <p className="text-brand-muted text-sm">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-ink">
            {greeting}, {displayName} 👋
          </h1>
          <p className="text-sm text-brand-muted mt-1 capitalize">{dateStr}</p>
        </div>
        <button
          onClick={() => navigate('/patients')}
          className="bg-brand-mid hover:bg-brand-dark text-white text-sm font-medium px-5 py-2.5 rounded-btn transition-colors"
        >
          + Nuevo paciente
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, accent }) => (
          <div key={label} className="bg-white rounded-card shadow-card border border-black/[0.06] p-6 flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.8px] text-brand-muted">{label}</p>
            <p className={`text-[36px] font-semibold leading-none ${accent ? 'text-brand-mid' : 'text-brand-ink'}`}>
              {value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent evaluations */}
        <div className="bg-white rounded-card shadow-card border border-black/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-brand-ink">Evaluaciones recientes</h2>
          </div>
          {recentPlans.length === 0 ? (
            <p className="text-sm text-brand-muted">No hay evaluaciones recientes.</p>
          ) : (
            <ul className="space-y-3">
              {recentPlans.map((plan) => {
                const badge = STATUS_LABELS[plan.status] ?? { label: plan.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <li key={plan.id} className="flex items-center gap-3 border-b border-black/[0.05] py-3 last:border-0 last:pb-0 first:pt-0">
                    <div className="w-[38px] h-[38px] rounded-full bg-[#ede9fe] flex items-center justify-center text-[13px] font-semibold text-brand-mid shrink-0">
                      {plan.patient_display_id.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/patients/${plan.patient_id}`}
                        className="font-semibold text-sm text-brand-ink hover:text-brand-mid truncate block"
                      >
                        {plan.patient_display_id}
                      </Link>
                      <p className="text-xs text-brand-muted truncate">{plan.protocol_name} · {timeAgo(plan.updated_at)}</p>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Classification distribution chart */}
        <div className="bg-white rounded-card shadow-card border border-black/[0.06] p-5">
          <h2 className="text-base font-semibold text-brand-ink mb-4">Distribución por clasificación</h2>
          <div data-testid="classification-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="clasificacion" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((entry) => (
                    <Cell
                      key={entry.clasificacion}
                      fill={CLASSIFICATION_COLORS[entry.clasificacion] || '#9839D1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
