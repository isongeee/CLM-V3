import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseConfig } from "./config.js";

let supabase;
let lastUrl = null;
let lastAnonKey = null;

export function supabaseClient() {
  const { url, anonKey } = requireSupabaseConfig();
  if (supabase && lastUrl === url && lastAnonKey === anonKey) return supabase;
  lastUrl = url;
  lastAnonKey = anonKey;
  supabase = createClient(url, anonKey);
  return supabase;
}
