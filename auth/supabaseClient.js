import { createClient } from "@supabase/supabase-js";
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
