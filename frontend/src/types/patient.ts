export interface Patient {
  id: string
  age: number
  education_years: number
  laterality: 'diestro' | 'zurdo' | 'ambidextro'
  initials: string | null
  display_id: string
  created_at: string
  created_by_id?: string | null
}

export interface TestSessionOut {
  id: string
  patient_id: string
  test_type: string
  date: string
  raw_data: Record<string, unknown>
  calculated_scores: {
    puntuacion_escalar?: number
    percentil?: number
    clasificacion?: string
    norma_aplicada?: Record<string, unknown>
  } | null
  qualitative_data: Record<string, unknown> | null
  protocol_id: string | null
  execution_plan_id: string | null
}
