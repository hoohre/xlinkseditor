import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import {
  clearSession,
  readSession,
  refreshEmailSession,
  saveSession,
  syncAllonelinkUser,
  type AuthProviderName,
  type AuthSession,
} from './session'

interface AuthContextValue {
  session: AuthSession | null
  finishAuthentication: (input: {
    idToken: string
    refreshToken?: string
    expiresIn?: string
    email?: string | null
    tokenType?: 'allonelink' | 'firebase'
    provider: AuthProviderName
  }) => Promise<void>
  getToken: () => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession())

  const finishAuthentication = useCallback<AuthContextValue['finishAuthentication']>(async (input) => {
    await syncAllonelinkUser(input.idToken)
    const next: AuthSession = {
      idToken: input.idToken,
      refreshToken: input.refreshToken,
      expiresAt: Date.now() + Number(input.expiresIn || 3600) * 1000,
      email: input.email ?? null,
      provider: input.provider,
      tokenType: input.tokenType ?? (input.refreshToken ? 'allonelink' : 'firebase'),
    }
    saveSession(next)
    setSession(next)
  }, [])

  const getToken = useCallback(async () => {
    if (!session) return null
    if (session.expiresAt > Date.now() + 60_000) return session.idToken
    if (session.tokenType === 'allonelink' || session.provider === 'password') {
      const refreshed = await refreshEmailSession(session)
      setSession(refreshed)
      return refreshed.idToken
    }
    await firebaseAuth?.authStateReady()
    if (firebaseAuth?.currentUser) {
      const idToken = await firebaseAuth.currentUser.getIdToken(true)
      const refreshed = { ...session, idToken, expiresAt: Date.now() + 55 * 60 * 1000 }
      saveSession(refreshed)
      setSession(refreshed)
      return idToken
    }
    const refreshed = await refreshEmailSession(session)
    setSession(refreshed)
    return refreshed.idToken
  }, [session])

  const logout = useCallback(async () => {
    if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined)
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, finishAuthentication, getToken, logout }),
    [finishAuthentication, getToken, logout, session],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
