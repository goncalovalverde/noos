import { http, HttpResponse } from 'msw'
import type { Patient } from '@/types/patient'

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
    if (params.id === mockPatient.id) return HttpResponse.json([mockSession])
    return HttpResponse.json([])
  }),
  http.get('/api/protocols/', () => HttpResponse.json([mockProtocol])),
  http.post('/api/execution-plans/', () => HttpResponse.json(mockPlan, { status: 201 })),
  http.get('/api/execution-plans/:id', () => HttpResponse.json(mockPlan)),
  http.patch('/api/execution-plans/:id', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...mockPlan, ...(body as object) })
  }),
  http.post('/api/tests/', () => HttpResponse.json({
    id: 'test-uuid-new', patient_id: 'test-uuid-1234', test_type: 'TMT-A',
    date: '2024-01-15T10:00:00Z', raw_data: { tiempo_segundos: 60 },
    calculated_scores: { puntuacion_escalar: 12, percentil: 75.0, clasificacion: 'Normal', norma_aplicada: { fuente: 'NEURONORMA' } },
    qualitative_data: {}, protocol_id: null, execution_plan_id: 'plan-uuid-1'
  }, { status: 201 })),
]

