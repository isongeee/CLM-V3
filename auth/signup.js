import { supabaseClient } from "./supabaseClient.js";
import {
  buildCreateOrgAction,
  buildJoinOrgAction,
  clearPendingOnboarding,
  savePendingOnboarding,
} from "./onboarding.js";
import { setText, showToast } from "./ui.js";

const form = document.getElementById("signup-form");
const statusEl = document.getElementById("status");
const createFields = document.getElementById("create-org-fields");
const joinFields = document.getElementById("join-org-fields");

const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
const getMode = () => modeInputs.find((i) => i.checked)?.value ?? "create";

const syncModeUI = () => {
  const mode = getMode();
  createFields.classList.toggle("hidden", mode !== "create");
  joinFields.classList.toggle("hidden", mode !== "join");
};

modeInputs.forEach((i) => i.addEventListener("change", syncModeUI));
syncModeUI();

async function runOnboardingIfPossible(action) {
  const supabase = supabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const hasSession = Boolean(sessionData?.session);
  if (!hasSession) return { done: false, reason: "no_session" };

  if (action.type === "create_org") {
    const { error } = await supabase.rpc("create_company_and_join", { p_company_name: action.companyName });
    if (error) throw error;
  } else if (action.type === "join_org") {
    const { error } = await supabase.rpc("join_company_by_invite_code", { p_invite_code: action.inviteCode });
    if (error) throw error;
  } else {
    throw new Error("Unknown onboarding action");
  }

  return { done: true };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setText("#status", "");
  clearPendingOnboarding();

  const data = new FormData(form);
  const fullName = String(data.get("full_name") ?? "").trim();
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const companyName = String(data.get("company_name") ?? "").trim();
  const inviteCode = String(data.get("invite_code") ?? "");

  const mode = getMode();
  let action;
  try {
    action = mode === "join" ? buildJoinOrgAction(inviteCode) : buildCreateOrgAction(companyName);
  } catch (err) {
    statusEl.textContent = err?.message || "Invalid input";
    return;
  }

  try {
    const supabase = supabaseClient();
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: new URL("./callback.html", window.location.href).toString(),
      },
    });
    if (error) throw error;

    savePendingOnboarding({ ...action, expectedEmail: email });

    const hasSession = Boolean(signUpData?.session);
    if (!hasSession) {
      statusEl.textContent =
        "Check your email to confirm your account. After confirming, return here and log in to finish setup.";
      showToast("Confirm your email");
      return;
    }

    await runOnboardingIfPossible(action);
    clearPendingOnboarding();
    showToast("Account created");
    window.location.assign("../app/index.html");
  } catch (err) {
    statusEl.textContent = err?.message || "Sign up failed";
  }
});
