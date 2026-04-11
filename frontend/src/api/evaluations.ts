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
  performed_at: string | null
  created_at: string
  updated_at: string
  allow_customization?: boolean
}

export interface ExecutionPlanSummary {
  id: string
  patient_id: string
  protocol_id: string | null
  protocol_name: string | null
  protocol_category: string | null
  status: string
  mode: string
  performed_at: string | null
  created_at: string
  test_count: number
  total_tests: number
}

export interface TestResultItem {
  id: string
  test_type: string
  date: string
  raw_data: Record<string, unknown>
  calculated_scores: {
    puntuacion_escalar?: number
    percentil?: number
    z_score?: number
    clasificacion?: string
    norma_aplicada?: Record<string, unknown>
  } | null
  qualitative_data: Record<string, unknown> | null
  clinical_session_id?: string | null
}

export interface ClinicalSessionSummary {
  id: string
  session_number: number
  session_date: string | null
  notes: string | null
}

export interface ExecutionPlanWithResults extends ExecutionPlanSummary {
  test_results: TestResultItem[]
  clinical_sessions?: ClinicalSessionSummary[]
  test_customizations?: TestCustomization[]
}

export interface IncompletePlan {
  id: string
  patient_id: string
  patient_display_id?: string
  protocol_id: string | null
  protocol_name: string | null
  status: string
  mode: string
  test_count: number
  total_tests: number
  performed_at: string | null
  created_at: string
}

export const listIncomplete = () =>
  apiClient.get<IncompletePlan[]>('/execution-plans/incomplete').then(r => r.data)

export const evaluationsApi = {
  create: async (patient_id: string, protocol_id: string, mode: string, performed_at?: string): Promise<ExecutionPlan> => {
    const { data } = await apiClient.post<ExecutionPlan>('/execution-plans/', { patient_id, protocol_id, mode, performed_at })
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
  listForPatient: async (patientId: string): Promise<ExecutionPlanSummary[]> => {
    const { data } = await apiClient.get<ExecutionPlanSummary[]>(`/execution-plans/patient/${patientId}`)
    return data
  },
  getWithResults: async (planId: string): Promise<ExecutionPlanWithResults> => {
    const { data } = await apiClient.get<ExecutionPlanWithResults>(`/execution-plans/${planId}/results`)
    return data
  },
  downloadReport: async (planId: string, format: 'pdf' | 'word', filename: string): Promise<void> => {
    const { data } = await apiClient.get(`/reports/${planId}/${format}`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([data]))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
