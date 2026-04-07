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

export const handlers = [
  http.get('/api/patients/', () => HttpResponse.json([mockPatient])),
  http.post('/api/patients/', async ({ request }) => {
    const body = await request.json() as Partial<Patient>
    return HttpResponse.json({ ...mockPatient, ...body }, { status: 201 })
  }),
  http.get('/api/patients/:id', ({ params }) => {
    if (params.id === mockPatient.id) return HttpResponse.json(mockPatient)
    return HttpResponse.json({ detail: 'Paciente no encontrado' }, { status: 404 })
  }),
]
