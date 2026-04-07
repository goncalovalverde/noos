import { apiClient } from './client'

export interface OverviewStats {
  total_patients: number
  tests_this_week: number
  active_protocols: number
  completed_this_month: number
}

export interface RecentPlan {
  id: string
  patient_display_id: string
  patient_id: string
  protocol_name: string
  status: string
  mode: string
  updated_at: string | null
}

export interface ClassificationCount {
  clasificacion: string
  count: number
}

export const getOverviewStats = () =>
  apiClient.get<OverviewStats>('/stats/overview').then(r => r.data)

export const getRecentPlans = () =>
  apiClient.get<RecentPlan[]>('/stats/recent-plans').then(r => r.data)

export const getClassificationDistribution = () =>
  apiClient.get<ClassificationCount[]>('/stats/classification-distribution').then(r => r.data)
