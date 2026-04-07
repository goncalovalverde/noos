export interface Patient {
  id: string
  age: number
  education_years: number
  laterality: 'diestro' | 'zurdo' | 'ambidextro'
  initials: string | null
  display_id: string
  created_at: string
}
