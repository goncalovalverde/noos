export interface User {
  id: string
  username: string
  email: string | null
  full_name: string | null
  role: 'Administrador' | 'Neuropsicólogo' | 'Observador'
  can_manage_protocols: boolean
  is_active: boolean
  last_login: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}
