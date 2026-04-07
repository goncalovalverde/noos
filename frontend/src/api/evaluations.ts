import { apiClient } from './client'

export interface TestCustomization {
  test_type: string
  order: number
  skip: boolean
  added: boolean
  repeat_later: boolean
  notes: string
}

export interface ExecutionPlan {
  id: string
  patient_id: string
  protocol_id: string | null
  status: string
  mode: string
  test_customizations: TestCustomization[]
  is_saved_variant: boolean
  variant_name: string | null
  created_at: string
  updated_at: string
}

export const evaluationsApi = {
  create: async (patient_id: string, protocol_id: string, mode: string): Promise<ExecutionPlan> => {
    const { data } = await apiClient.post<ExecutionPlan>('/execution-plans/', { patient_id, protocol_id, mode })
    return data
  },
  get: async (planId: string): Promise<ExecutionPlan> => {
    const { data } = await apiClient.get<ExecutionPlan>(`/execution-plans/${planId}`)
    return data
  },
  update: async (planId: string, body: Partial<ExecutionPlan>): Promise<ExecutionPlan> => {
    const { data } = await apiClient.patch<ExecutionPlan>(`/execution-plans/${planId}`, body)
    return data
  },
}
