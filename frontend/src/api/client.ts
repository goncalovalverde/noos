import axios from 'axios'
import { useAuthStore } from '@/store/auth'

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  try {
    const token = useAuthStore.getState().token
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    // Store may be mocked in test environment
  }
  return config
})

// Track whether a refresh is already in-flight to avoid cascading retries.
let _isRefreshing = false
let _refreshQueue: Array<(token: string) => void> = []

function _processQueue(newToken: string) {
  _refreshQueue.forEach((cb) => cb(newToken))
  _refreshQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // Only attempt refresh on 401s, skip the refresh endpoint itself,
    // and don't retry a request that already tried once.
    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/auth/refresh')
    ) {
      const { refreshToken, updateTokens, logout } = useAuthStore.getState()

      if (!refreshToken) {
        logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (_isRefreshing) {
        // Queue this request until the ongoing refresh completes.
        return new Promise((resolve) => {
          _refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(original))
          })
        })
      }

      original._retried = true
      _isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
        updateTokens(data.access_token, data.refresh_token)
        _processQueue(data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch {
        logout()
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        _isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

