import type { Session, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => callback(session))
  },

  async signInWithPassword(creds: SignInWithPasswordCredentials) {
    return supabase.auth.signInWithPassword(creds)
  },

  async signUp(creds: SignUpWithPasswordCredentials) {
    return supabase.auth.signUp(creds)
  },

  async signOut() {
    return supabase.auth.signOut()
  }
}

