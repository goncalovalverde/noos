import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import type { PatientCreate } from '@/api/patients'

const schema = z.object({
  age: z.number({ invalid_type_error: 'Edad requerida' }).int().min(1).max(119),
  education_years: z.number({ invalid_type_error: 'Años de educación requeridos' }).int().min(0).max(30),
  laterality: z.enum(['diestro', 'zurdo', 'ambidextro']),
  initials: z.string().max(10).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  onSubmit: (data: PatientCreate) => Promise<void>
  onClose: () => void
  defaultValues?: Partial<FormValues>
}

export default function PatientForm({ onSubmit, onClose, defaultValues }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { laterality: 'diestro', ...defaultValues },
  })

  const onValid = async (values: FormValues) => {
    await onSubmit({
      age: values.age,
      education_years: values.education_years,
      laterality: values.laterality,
      initials: values.initials || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-brand-dark/45 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-card shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-brand-ink">Nuevo paciente</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onValid)} className="px-6 py-5 space-y-4">
          {/* Privacy notice */}
          <p className="text-xs text-brand-muted bg-brand-bg rounded-input px-3 py-2">
            🔒 Solo se almacenan datos anónimos — sin nombre, DNI ni datos identificativos.
          </p>

          {/* Initials */}
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Iniciales <span className="text-brand-muted font-normal">(opcional)</span>
            </label>
            <input
              {...register('initials')}
              placeholder="ej. JMR"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
          </div>

          {/* Age */}
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-brand-ink mb-1">
              Edad <span className="text-clinical-impaired">*</span>
            </label>
            <input
              id="age"
              {...register('age', { valueAsNumber: true })}
              type="number"
              min={1}
              max={119}
              placeholder="65"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
            {errors.age && <p className="mt-1 text-xs text-clinical-impaired">{errors.age.message}</p>}
          </div>

          {/* Education */}
          <div>
            <label htmlFor="education" className="block text-sm font-medium text-brand-ink mb-1">
              Años de educación <span className="text-clinical-impaired">*</span>
            </label>
            <input
              id="education"
              {...register('education_years', { valueAsNumber: true })}
              type="number"
              min={0}
              max={30}
              placeholder="12"
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid"
            />
            {errors.education_years && <p className="mt-1 text-xs text-clinical-impaired">{errors.education_years.message}</p>}
          </div>

          {/* Laterality */}
          <div>
            <label className="block text-sm font-medium text-brand-ink mb-1">
              Lateralidad <span className="text-clinical-impaired">*</span>
            </label>
            <select
              {...register('laterality')}
              className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-mid"
            >
              <option value="diestro">Diestro</option>
              <option value="zurdo">Zurdo</option>
              <option value="ambidextro">Ambidextro</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 text-brand-ink text-sm font-medium rounded-btn hover:bg-brand-bg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 bg-brand-mid text-white text-sm font-medium rounded-btn hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
