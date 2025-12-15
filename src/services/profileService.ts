import { supabase } from '../lib/supabaseClient'

export const profileService = {
  async ensureUserProfile() {
    await supabase.functions.invoke('ensure-user-profile', { body: {} })
  }
}

