import { apiClient } from './client'
import type { TokenResponse, User } from '@/types/auth'

export const authApi = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/login', { username, password })
    return data
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken })
    return data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  changePassword: async (current_password: string, new_password: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { current_password, new_password })
  },
}
