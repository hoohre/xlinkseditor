import { apiRequest } from '../lib/api'
import { encryptEmailCredentials } from '../lib/crypto'

export type AuthProviderName = 'password' | 'google.com' | 'facebook.com'

export interface AuthSession {
  idToken: string
  refreshToken?: string
  expiresAt: number
  email: string | null
  tokenType?: 'allonelink' | 'firebase'
  provider: AuthProviderName
}

export interface PendingSocialCredential {
  providerId: 'google.com' | 'facebook.com'
  socialToken: string
  createdAt?: number
  email: string
}

const SESSION_KEY = 'allonelink.auth.session.v1'
const PENDING_KEY = 'allonelink.auth.pending-social.v1'

export const readSession = (): AuthSession | null => {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? (JSON.parse(value) as AuthSession) : null
  } catch {
    return null
  }
}

export const saveSession = (session: AuthSession): void =>
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))

export const clearSession = (): void => localStorage.removeItem(SESSION_KEY)

export const savePendingSocial = (credential: PendingSocialCredential): void =>
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...credential, createdAt: Date.now() }))

export const readPendingSocial = (): PendingSocialCredential | null => {
  try {
    const value = sessionStorage.getItem(PENDING_KEY)
    if (!value) return null
    const pending = JSON.parse(value) as PendingSocialCredential
    if (!pending.createdAt || Date.now() - pending.createdAt > 5 * 60 * 1000) { clearPendingSocial(); return null }
    return pending
  } catch {
    return null
  }
}

export const clearPendingSocial = (): void => sessionStorage.removeItem(PENDING_KEY)

export interface AuthTokenResponse {
  idToken: string
  refreshToken: string
  expiresIn: string
  tokenType?: 'allonelink' | 'firebase'
  localId: string
  email?: string
}

export async function emailAuthenticate(
  intent: 'login' | 'register',
  email: string,
  password: string,
): Promise<AuthTokenResponse> {
  const envelope = await encryptEmailCredentials({ intent, email, password })
  return apiRequest<AuthTokenResponse>(`/api/v1/auth/email/${intent}`, {
    method: 'POST',
    body: JSON.stringify(envelope),
  })
}

export async function linkPendingSocial(
  idToken: string,
  pending: PendingSocialCredential,
): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>('/api/v1/auth/social/link', {
    method: 'POST',
    body: JSON.stringify({
      idToken,
      socialToken: pending.socialToken,
    }),
  })
}

export async function syncAllonelinkUser(idToken: string): Promise<void> {
  await apiRequest('/api/v1/auth/sync', { method: 'POST' }, idToken)
}

export async function refreshEmailSession(session: AuthSession): Promise<AuthSession> {
  if (!session.refreshToken) throw new Error('Session expired. Please log in again.')
  const body = await apiRequest<AuthTokenResponse>('/api/v1/auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken: session.refreshToken }),
  })
  const refreshed = { ...session, idToken: body.idToken, refreshToken: body.refreshToken, tokenType: 'allonelink' as const, expiresAt: Date.now() + Number(body.expiresIn) * 1000 }
  saveSession(refreshed)
  return refreshed
}

export async function updatePassword(token: string, email: string, password: string, newPassword: string) {
  const envelope = await encryptEmailCredentials({ intent: 'change_password', email, password, newPassword })
  return apiRequest<AuthTokenResponse>('/api/v1/me/password', { method: 'POST', body: JSON.stringify(envelope) }, token)
}
