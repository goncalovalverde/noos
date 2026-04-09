import { apiClient } from './client'

export interface UserOut {
  id: string
  username: string
  email?: string | null
  full_name?: string | null
  role: string
  can_manage_protocols: boolean
  is_active: boolean
  created_at: string
  last_login?: string | null
}

export interface UserCreate {
  username: string
  password: string
  email?: string
  full_name?: string
  role?: string
  can_manage_protocols?: boolean
}

export interface UserUpdate {
  email?: string
  full_name?: string
  role?: string
  can_manage_protocols?: boolean
  is_active?: boolean
}

export interface ProfileUpdate {
  email?: string
  current_password?: string
  new_password?: string
}

export const usersApi = {
  list: async (): Promise<UserOut[]> => {
    const { data } = await apiClient.get<UserOut[]>('/users/')
    return data
  },
  create: async (body: UserCreate): Promise<UserOut> => {
    const { data } = await apiClient.post<UserOut>('/users/', body)
    return data
  },
  update: async (id: string, body: UserUpdate): Promise<UserOut> => {
    const { data } = await apiClient.patch<UserOut>(`/users/${id}`, body)
    return data
  },
  setPassword: async (id: string, newPassword: string): Promise<void> => {
    await apiClient.post(`/users/${id}/set-password`, { new_password: newPassword })
  },
  delete: async (id: string, reassignTo?: string): Promise<void> => {
    const params = reassignTo ? `?reassign_to=${reassignTo}` : ''
    await apiClient.delete(`/users/${id}${params}`)
  },
  getPatientsCount: async (id: string): Promise<number> => {
    const { data } = await apiClient.get<{ count: number }>(`/users/${id}/patients-count`)
    return data.count
  },
  getMe: async (): Promise<UserOut> => {
    const { data } = await apiClient.get<UserOut>('/users/me')
    return data
  },
  updateMe: async (body: ProfileUpdate): Promise<UserOut> => {
    const { data } = await apiClient.patch<UserOut>('/users/me', body)
    return data
  },
}
