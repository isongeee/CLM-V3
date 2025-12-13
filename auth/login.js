import { supabaseClient } from "./supabaseClient.js";
import { setText, showToast } from "./ui.js";

const form = document.getElementById("login-form");
const statusEl = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setText("#status", "");

  const data = new FormData(form);
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");

  try {
    const supabase = supabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showToast("Logged in");
    window.location.assign("../app/index.html");
  } catch (err) {
    const msg = err?.message || "Login failed";
    statusEl.textContent = msg;
  }
});
