import { apiClient } from './client'

export interface Protocol {
  id: string
  name: string
  description: string | null
  category: string | null
  tests: Array<{ test_type: string; order: number; default_notes: string | null }>
  created_at: string
  updated_at: string
}

export const protocolsApi = {
  list: async (): Promise<Protocol[]> => {
    const { data } = await apiClient.get<Protocol[]>('/protocols/')
    return data
  },
  get: async (id: string): Promise<Protocol> => {
    const { data } = await apiClient.get<Protocol>(`/protocols/${id}`)
    return data
  },
}
