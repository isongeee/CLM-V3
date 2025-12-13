import test from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig, requireSupabaseConfig, setSupabaseConfig } from "../auth/config.js";
import { createMemoryStorage } from "./memoryStorage.mjs";

const DEFAULT_URL = "https://htpxtutbqmglvosikjwf.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cHh0dXRicW1nbHZvc2lrandmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzExMTYsImV4cCI6MjA4MTE0NzExNn0.vHb1NO_wR5Hg6OfFwkWTPKDvktbiVH-KMxt1povmmyw";

test("getSupabaseConfig reads from storage first", () => {
  const storage = createMemoryStorage({
    "clm:supabase:url": "https://example.supabase.co",
    "clm:supabase:anonKey": "anon",
  });

  assert.deepEqual(getSupabaseConfig(storage), { url: "https://example.supabase.co", anonKey: "anon" });
});

test("setSupabaseConfig persists and requireSupabaseConfig returns", () => {
  const storage = createMemoryStorage();
  setSupabaseConfig({ url: "https://x.supabase.co", anonKey: "k" }, storage);
  assert.deepEqual(requireSupabaseConfig(storage), { url: "https://x.supabase.co", anonKey: "k" });
});

test("requireSupabaseConfig falls back to defaults when missing", () => {
  const storage = createMemoryStorage();
  assert.deepEqual(requireSupabaseConfig(storage), { url: DEFAULT_URL, anonKey: DEFAULT_ANON_KEY });
});
