const STORAGE_KEYS = {
  url: "clm:supabase:url",
  anonKey: "clm:supabase:anonKey",
};

const DEFAULT_SUPABASE_CONFIG = {
  url: "https://htpxtutbqmglvosikjwf.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cHh0dXRicW1nbHZvc2lrandmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzExMTYsImV4cCI6MjA4MTE0NzExNn0.vHb1NO_wR5Hg6OfFwkWTPKDvktbiVH-KMxt1povmmyw",
};

export function getSupabaseConfig(storage = window.localStorage) {
  const url = storage.getItem(STORAGE_KEYS.url) ?? "";
  const anonKey = storage.getItem(STORAGE_KEYS.anonKey) ?? "";

  if (url && anonKey) return { url, anonKey };

  const fromWindow = typeof window !== "undefined" ? window.__SUPABASE__ : null;
  const fallbackUrl = fromWindow?.url ?? "";
  const fallbackAnonKey = fromWindow?.anonKey ?? "";

  return {
    url: url || fallbackUrl || DEFAULT_SUPABASE_CONFIG.url,
    anonKey: anonKey || fallbackAnonKey || DEFAULT_SUPABASE_CONFIG.anonKey,
  };
}

export function setSupabaseConfig({ url, anonKey }, storage = window.localStorage) {
  storage.setItem(STORAGE_KEYS.url, url);
  storage.setItem(STORAGE_KEYS.anonKey, anonKey);
}

export function requireSupabaseConfig(storage = window.localStorage) {
  const { url, anonKey } = getSupabaseConfig(storage);
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase config. Set URL + anon key in the page's Supabase config section."
    );
  }
  return { url, anonKey };
}
