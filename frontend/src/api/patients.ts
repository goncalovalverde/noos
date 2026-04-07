import { apiClient } from './client'
import type { Patient } from '@/types/patient'

export interface PatientCreate {
  age: number
  education_years: number
  laterality: 'diestro' | 'zurdo' | 'ambidextro'
  initials?: string
}

export const patientsApi = {
  list: async (page = 1, size = 20): Promise<Patient[]> => {
    const { data } = await apiClient.get<Patient[]>('/patients/', { params: { page, size } })
    return data
  },
  get: async (id: string): Promise<Patient> => {
    const { data } = await apiClient.get<Patient>(`/patients/${id}`)
    return data
  },
  create: async (body: PatientCreate): Promise<Patient> => {
    const { data } = await apiClient.post<Patient>('/patients/', body)
    return data
  },
  update: async (id: string, body: Partial<PatientCreate>): Promise<Patient> => {
    const { data } = await apiClient.put<Patient>(`/patients/${id}`, body)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/patients/${id}`)
  },
}
