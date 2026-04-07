import { http, HttpResponse } from 'msw'
import type { Patient } from '@/types/patient'
import type { UserOut } from '@/api/users'

export const mockUser: UserOut = {
  id: 'user-uuid-1',
  username: 'dra.martinez',
  full_name: 'Dra. Ana Martínez',
  email: 'ana@triune.es',
  role: 'Neuropsicólogo',
  can_manage_protocols: false,
  is_active: true,
  created_at: new Date().toISOString(),
  last_login: new Date().toISOString(),
}

export const mockPatient: Patient = {
  id: 'test-uuid-1234',
  age: 65,
  education_years: 12,
  laterality: 'diestro',
  initials: 'JMR',
  display_id: 'JMR (1234)',
  created_at: '2024-01-15T10:00:00Z',
}

export const mockSession = {
  id: 'session-uuid-1',
  patient_id: 'test-uuid-1234',
  test_type: 'TMT-A',
  date: '2024-01-15T10:00:00Z',
  raw_data: { tiempo_segundos: 45 },
  calculated_scores: {
    puntuacion_escalar: 12,
    percentil: 75.0,
    clasificacion: 'Normal',
    norma_aplicada: { fuente: 'NEURONORMA' }
  },
  qualitative_data: {},
  protocol_id: null,
  execution_plan_id: null,
}

export const mockProtocol = {
  id: 'protocol-uuid-1',
  name: 'Rastreio Cognitivo',
  category: 'Rastreio',
  description: 'Protocolo de rastreio breve',
  tests: [
    { test_type: 'TMT-A', order: 1, default_notes: null },
    { test_type: 'Fluidez-FAS', order: 2, default_notes: null },
    { test_type: 'TAVEC', order: 3, default_notes: null },
  ],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockPlan = {
  id: 'plan-uuid-1',
  patient_id: 'test-uuid-1234',
  protocol_id: 'protocol-uuid-1',
  status: 'active',
  mode: 'live',
  test_customizations: [
    { test_type: 'TMT-A', order: 1, skip: false, added: false, repeat_later: false, notes: '' },
    { test_type: 'Fluidez-FAS', order: 2, skip: false, added: false, repeat_later: false, notes: '' },
    { test_type: 'TAVEC', order: 3, skip: false, added: false, repeat_later: false, notes: '' },
  ],
  is_saved_variant: false,
  variant_name: null,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockCompletedPlan = {
  ...mockPlan,
  id: 'plan-uuid-completed',
  status: 'completed',
}

export const mockSessionTMT = {
  ...mockSession,
  id: 'session-tmt',
  test_type: 'TMT-A',
  execution_plan_id: 'plan-uuid-completed',
  calculated_scores: {
    puntuacion_escalar: 8,
    percentil: 25.0,
    z_score: -0.67,
    clasificacion: 'Normal',
    norma_aplicada: { fuente: 'NEURONORMA', test: 'TMT-A', rango_edad: '65-80', rango_educacion: '8-12' },
  },
  raw_data: { tiempo: 60, errores: 1 },
  qualitative_data: { observaciones: '' },
}

export const mockSessionFluency = {
  ...mockSession,
  id: 'session-fluency',
  test_type: 'Fluidez-FAS',
  execution_plan_id: 'plan-uuid-completed',
  calculated_scores: {
    puntuacion_escalar: 13,
    percentil: 84.0,
    z_score: 1.0,
    clasificacion: 'Superior',
    norma_aplicada: { fuente: 'NEURONORMA', test: 'Fluidez-FAS', rango_edad: '65-80', rango_educacion: '8-12' },
  },
  raw_data: { letra_f: 14, letra_a: 12, letra_s: 11 },
  qualitative_data: { observaciones: 'Muy buena ejecución' },
}

export const handlers = [
  http.get('/api/patients/', () => HttpResponse.json([mockPatient])),
  http.post('/api/patients/', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...mockPatient, ...(body as object) }, { status: 201 })
  }),
  http.get('/api/patients/:id', ({ params }) => {
    if (params.id === mockPatient.id) return HttpResponse.json(mockPatient)
    return HttpResponse.json({ detail: 'Paciente no encontrado' }, { status: 404 })
  }),
  http.get('/api/patients/:id/sessions', ({ params }) => {
    if (params.id === mockPatient.id) return HttpResponse.json([mockSessionTMT, mockSessionFluency])
    return HttpResponse.json([])
  }),
  http.get('/api/protocols/', () => HttpResponse.json([mockProtocol])),
  http.post('/api/protocols/', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockProtocol, ...body, id: 'protocol-uuid-new' }, { status: 201 })
  }),
  http.get('/api/protocols/:id', ({ params }) => HttpResponse.json(mockProtocol)),
  http.put('/api/protocols/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockProtocol, ...body })
  }),
  http.delete('/api/protocols/:id', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/execution-plans/', () => HttpResponse.json(mockPlan, { status: 201 })),
  http.get('/api/execution-plans/:id', ({ params }) => {
    if (params.id === mockCompletedPlan.id) return HttpResponse.json(mockCompletedPlan)
    return HttpResponse.json(mockPlan)
  }),
  http.patch('/api/execution-plans/:id', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...mockPlan, ...(body as object) })
  }),
  http.get('/api/users/', () => HttpResponse.json([mockUser])),
  http.post('/api/users/', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockUser, ...body, id: 'user-uuid-new' }, { status: 201 })
  }),
  http.patch('/api/users/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockUser, ...body })
  }),
  http.delete('/api/users/:id', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/tests/', () => HttpResponse.json({
    id: 'test-uuid-new', patient_id: 'test-uuid-1234', test_type: 'TMT-A',
    date: '2024-01-15T10:00:00Z', raw_data: { tiempo_segundos: 60 },
    calculated_scores: { puntuacion_escalar: 12, percentil: 75.0, clasificacion: 'Normal', norma_aplicada: { fuente: 'NEURONORMA' } },
    qualitative_data: {}, protocol_id: null, execution_plan_id: 'plan-uuid-1'
  }, { status: 201 })),
  http.get('/api/reports/:planId/pdf', () =>
    new HttpResponse(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      headers: { 'content-type': 'application/pdf' },
    })
  ),
  http.get('/api/reports/:planId/word', () =>
    new HttpResponse(new Uint8Array([0x50, 0x4B, 0x03, 0x04]), {
      headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    })
  ),
]

