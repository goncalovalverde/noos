import { apiClient } from './client'

export interface ClinicalSessionCreate {
  session_date: string // YYYY-MM-DD
  notes?: string
}

export interface ClinicalSession {
  id: string
  execution_plan_id: string
  session_number: number
  session_date: string
  notes: string | null
  created_at: string
  test_count?: number
  test_types?: string[]
}

export const clinicalSessionsApi = {
  create: async (planId: string, body: ClinicalSessionCreate): Promise<ClinicalSession> => {
    const { data } = await apiClient.post<ClinicalSession>(`/plans/${planId}/sessions/`, body)
    return data
  },
  list: async (planId: string): Promise<ClinicalSession[]> => {
    const { data } = await apiClient.get<ClinicalSession[]>(`/plans/${planId}/sessions/`)
    return data
  },
  get: async (planId: string, sessionId: string): Promise<ClinicalSession> => {
    const { data } = await apiClient.get<ClinicalSession>(`/plans/${planId}/sessions/${sessionId}`)
    return data
  },
}
