import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brain, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'

const schema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})
type FormValues = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const res = await authApi.login(values.username, values.password)
      login(res.access_token, res.user)
      navigate('/dashboard')
    } catch (err: any) {
      setServerError(err.response?.data?.detail ?? 'Error al iniciar sesión')
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-brand-dark flex items-center justify-center mb-3">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-brand-dark tracking-tight">Nóos</h1>
          <p className="text-sm text-brand-muted mt-1">Triune Neuropsicología</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-card shadow-card p-6">
          <h2 className="text-lg font-semibold text-brand-ink mb-5">Iniciar sesión</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-ink mb-1">Usuario</label>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                placeholder="tu.usuario"
                className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid focus:border-transparent"
              />
              {errors.username && <p className="mt-1 text-xs text-clinical-impaired">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-ink mb-1">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-mid focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-clinical-impaired">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-input bg-red-50 border border-red-200 px-3 py-2 text-sm text-clinical-impaired">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-brand-mid hover:bg-brand-dark text-white font-medium text-sm rounded-btn transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
