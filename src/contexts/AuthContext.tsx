import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'
import { getErrorMessage } from '../services/errors'
import { profileService } from '../services/profileService'

type Result = { ok: true } | { ok: false; error: string }

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  signInWithPassword: (creds: { email: string; password: string }) => Promise<Result>
  signUp: (creds: { email: string; password: string }) => Promise<Result>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    authService
      .getSession()
      .then((s) => {
        if (!isMounted) return
        setSession(s)
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })

    const { data } = authService.onAuthStateChange(async (s) => {
      setSession(s)
      if (s) {
        try {
          await profileService.ensureUserProfile()
        } catch {
          // Non-fatal: dev environments might not have functions deployed yet.
        }
      }
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      async signInWithPassword(creds) {
        try {
          const { error } = await authService.signInWithPassword(creds)
          if (error) return { ok: false, error: error.message }
          return { ok: true }
        } catch (e) {
          return { ok: false, error: getErrorMessage(e) }
        }
      },
      async signUp(creds) {
        try {
          const { error } = await authService.signUp(creds)
          if (error) return { ok: false, error: error.message }
          try {
            await profileService.ensureUserProfile()
          } catch {
            // ignore
          }
          return { ok: true }
        } catch (e) {
          return { ok: false, error: getErrorMessage(e) }
        }
      },
      async signOut() {
        await authService.signOut()
      }
    }),
    [isLoading, session]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

