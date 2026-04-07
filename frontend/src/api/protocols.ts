import { apiClient } from './client'

export interface ProtocolTestIn {
  test_type: string
  order: number
  default_notes?: string | null
}

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
  list: async (category?: string): Promise<Protocol[]> => {
    const params = category ? { category } : {}
    const { data } = await apiClient.get<Protocol[]>('/protocols/', { params })
    return data
  },
  get: async (id: string): Promise<Protocol> => {
    const { data } = await apiClient.get<Protocol>(`/protocols/${id}`)
    return data
  },
  create: async (payload: { name: string; description?: string; category?: string; tests: ProtocolTestIn[] }): Promise<Protocol> => {
    const { data } = await apiClient.post<Protocol>('/protocols/', payload)
    return data
  },
  update: async (id: string, payload: { name?: string; description?: string; category?: string; tests?: ProtocolTestIn[] }): Promise<Protocol> => {
    const { data } = await apiClient.put<Protocol>(`/protocols/${id}`, payload)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/protocols/${id}`)
  },
}
