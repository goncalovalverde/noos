type PydanticDetail = { loc?: string[]; msg?: string; type?: string }

/**
 * Extracts a human-readable error message from an Axios error.
 * Handles both plain string `detail` (FastAPI HTTPException) and
 * array `detail` (Pydantic 422 validation errors).
 */
export function extractApiError(err: unknown, fallback = 'Ha ocurrido un error'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return (detail as PydanticDetail[])
      .map((e) => [e.loc?.slice(1).join('.'), e.msg].filter(Boolean).join(': '))
      .join(' · ')
  }

  return fallback
}
