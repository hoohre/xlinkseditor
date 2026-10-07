export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '')

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown }
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (response.status === 204) return undefined as T
  const body = (await response.json()) as { data?: T } & ApiErrorBody
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body.error?.code ?? 'request_failed',
      body.error?.message ?? 'Request failed',
    )
  }
  return body.data as T
}
