const PENDING_KEY = "clm:onboarding:pending";

export function normalizeInviteCode(inviteCode) {
  return String(inviteCode ?? "").trim().toLowerCase();
}

export function savePendingOnboarding(action, storage = window.localStorage) {
  storage.setItem(PENDING_KEY, JSON.stringify(action));
}

export function loadPendingOnboarding(storage = window.localStorage) {
  const raw = storage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingOnboarding(storage = window.localStorage) {
  storage.removeItem(PENDING_KEY);
}

export function buildCreateOrgAction(companyName) {
  const name = String(companyName ?? "").trim();
  if (!name) throw new Error("Organization name is required.");
  return { type: "create_org", companyName: name };
}

export function buildJoinOrgAction(inviteCode) {
  const normalized = normalizeInviteCode(inviteCode);
  if (!normalized) throw new Error("Invite code is required.");
  return { type: "join_org", inviteCode: normalized };
}

