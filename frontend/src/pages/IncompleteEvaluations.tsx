import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { listIncomplete, type IncompletePlan } from '@/api/evaluations'

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  active: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  abandoned: 'bg-red-100 text-red-600',
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completado', active: 'En curso', draft: 'Borrador', abandoned: 'Abandonado',
}

function getInitials(displayId: string): string {
  const parts = displayId.trim().split(/[\s\-]/)
  return parts.slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '??'
}

export default function IncompleteEvaluations() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<IncompletePlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listIncomplete()
      .then(setPlans)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-brand-muted hover:text-brand-ink transition-colors"
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-brand-ink">Evaluaciones en curso</h1>
          <p className="text-sm text-brand-muted mt-0.5">Protocolos activos o en borrador pendientes de completar</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-card shadow-card border border-black/[0.06]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-brand-muted" />
          </div>
        ) : plans.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-brand-muted">No hay evaluaciones en curso.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {plans.map((plan) => (
              <li key={plan.id} className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className="w-[40px] h-[40px] rounded-full bg-[#ede9fe] flex items-center justify-center text-[13px] font-semibold text-brand-mid shrink-0">
                  {getInitials(plan.patient_display_id ?? plan.patient_id)}
                </div>

                {/* Patient + protocol info */}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/patients/${plan.patient_id}`}
                    className="font-semibold text-sm text-brand-ink hover:text-brand-mid truncate block"
                  >
                    {plan.patient_display_id ?? plan.patient_id}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-brand-muted truncate">
                      {plan.protocol_name ?? 'Sin protocolo'}
                    </span>
                    {plan.mode === 'paper' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        Diferido
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="text-xs text-brand-muted whitespace-nowrap">
                  {plan.test_count}/{plan.total_tests} tests
                </div>

                {/* Status badge */}
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[plan.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[plan.status] ?? plan.status}
                </span>

                {/* Continue button */}
                <button
                  onClick={() => navigate(`/patients/${plan.patient_id}/evaluate/${plan.id}`)}
                  className="text-[13px] font-medium text-white bg-brand-mid hover:bg-brand-dark px-3.5 py-1.5 rounded-btn transition-colors whitespace-nowrap"
                >
                  Continuar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
