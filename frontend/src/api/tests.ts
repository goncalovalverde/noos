import { apiClient } from './client'
import type { TestSessionOut } from '@/types/patient'

export interface TestCreate {
  patient_id: string
  test_type: string
  execution_plan_id?: string
  protocol_id?: string
  clinical_session_id?: string
  raw_data: Record<string, unknown>
  qualitative_data?: Record<string, unknown>
}

export const testsApi = {
  create: async (body: TestCreate): Promise<TestSessionOut> => {
    const { data } = await apiClient.post<TestSessionOut>('/tests/', body)
    return data
  },
  get: async (id: string): Promise<TestSessionOut> => {
    const { data } = await apiClient.get<TestSessionOut>(`/tests/${id}`)
    return data
  },
  update: async (id: string, raw_data: Record<string, unknown>, qualitative_data?: Record<string, unknown>): Promise<TestSessionOut> => {
    const { data } = await apiClient.patch<TestSessionOut>(`/tests/${id}`, { raw_data, qualitative_data })
    return data
  },
}
