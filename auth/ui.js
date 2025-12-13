import { getSupabaseConfig, setSupabaseConfig } from "./config.js";

export function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

export function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

export function setText(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = text;
}

export function setHidden(selector, hidden) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.hidden = hidden;
}

export function initSupabaseConfigForm() {
  const urlInput = document.querySelector("[data-supabase-url]");
  const anonKeyInput = document.querySelector("[data-supabase-anon-key]");
  const saveButton = document.querySelector("[data-save-supabase-config]");
  if (!urlInput || !anonKeyInput || !saveButton) return;

  const { url, anonKey } = getSupabaseConfig();
  urlInput.value = url;
  anonKeyInput.value = anonKey;

  saveButton.addEventListener("click", () => {
    setSupabaseConfig({ url: urlInput.value.trim(), anonKey: anonKeyInput.value.trim() });
    showToast("Saved Supabase config");
  });
}

