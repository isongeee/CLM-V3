import { supabaseClient } from "./supabaseClient.js";
import { initSupabaseConfigForm, showToast } from "./ui.js";

initSupabaseConfigForm();

const statusEl = document.getElementById("status");

try {
  const supabase = supabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
  if (error) throw error;
  showToast("Signed in");
  window.location.assign("../app/index.html");
} catch (err) {
  statusEl.textContent = err?.message || "Callback failed. Try logging in again.";
}

