import { supabaseClient } from "../auth/supabaseClient.js";
import { clearPendingOnboarding, loadPendingOnboarding } from "../auth/onboarding.js";
import { initSupabaseConfigForm, showToast } from "../auth/ui.js";

initSupabaseConfigForm();

const sessionStatus = document.getElementById("session-status");
const onboardingStatus = document.getElementById("onboarding-status");
const companiesEl = document.getElementById("companies");
const signOutButton = document.getElementById("sign-out");

function renderCompanies(companies) {
  if (!companies?.length) {
    companiesEl.textContent = "No organizations yet.";
    return;
  }

  const rows = companies
    .map((c) => {
      const invite = c.invite_code ? ` · invite: ${escapeHtml(c.invite_code)}` : "";
      return `<li>
        <strong>${escapeHtml(c.name ?? c.id)}</strong>
        <span class="muted">${invite}</span>
        <a href="./subscription.html?companyId=${c.id}" style="float:right; text-decoration:none; font-size:0.8em; padding:2px 8px; border:1px solid #ccc; border-radius:4px; color:#333;">Billing</a>
      </li>`;
    })
    .join("");
  companiesEl.innerHTML = `<ul class="list" style="padding:0; list-style:none;">${rows}</ul>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch] ?? ch;
  });
}

async function requireSessionOrRedirect() {
  const supabase = supabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data?.session) {
    window.location.assign("../auth/login.html");
    return null;
  }
  return data.session;
}

async function runPendingOnboardingIfAny(session) {
  const pending = loadPendingOnboarding();
  if (!pending) {
    onboardingStatus.textContent = "No pending onboarding.";
    return;
  }

  const expectedEmail = String(pending.expectedEmail ?? "").trim().toLowerCase();
  const sessionEmail = String(session?.user?.email ?? "").trim().toLowerCase();
  if (expectedEmail && sessionEmail && expectedEmail !== sessionEmail) {
    clearPendingOnboarding();
    onboardingStatus.textContent = "Pending onboarding belonged to a different account and was cleared.";
    showToast("Cleared pending onboarding");
    return;
  }

  onboardingStatus.textContent = "Finishing onboarding…";
  const supabase = supabaseClient();

  try {
    if (pending.type === "create_org") {
      const { error } = await supabase.rpc("create_company_and_join", { p_company_name: pending.companyName });
      if (error) throw error;
      onboardingStatus.textContent = `Organization created: ${pending.companyName}`;
    } else if (pending.type === "join_org") {
      const { error } = await supabase.rpc("join_company_by_invite_code", { p_invite_code: pending.inviteCode });
      if (error) throw error;
      onboardingStatus.textContent = "Joined organization.";
    } else {
      onboardingStatus.textContent = "Unknown onboarding action.";
    }
    clearPendingOnboarding();
    showToast("Onboarding complete");
  } catch (err) {
    onboardingStatus.textContent = err?.message || "Onboarding failed";
  }
}

async function loadCompanies() {
  const supabase = supabaseClient();
  const { data, error } = await supabase.from("companies").select("id,name,invite_code").order("created_at", { ascending: false });
  if (error) throw error;
  renderCompanies(data);
}

signOutButton.addEventListener("click", async () => {
  const supabase = supabaseClient();
  await supabase.auth.signOut();
  window.location.assign("../auth/login.html");
});

try {
  const session = await requireSessionOrRedirect();
  if (session) {
    sessionStatus.textContent = `Signed in as ${session.user?.email ?? session.user?.id}`;
    await runPendingOnboardingIfAny(session);
    await loadCompanies();
  }
} catch (err) {
  sessionStatus.textContent = err?.message || "App error";
}
