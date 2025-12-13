import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreateOrgAction,
  buildJoinOrgAction,
  clearPendingOnboarding,
  loadPendingOnboarding,
  normalizeInviteCode,
  savePendingOnboarding,
} from "../auth/onboarding.js";
import { createMemoryStorage } from "./memoryStorage.mjs";

test("normalizeInviteCode trims and lowercases", () => {
  assert.equal(normalizeInviteCode("  AbC123  "), "abc123");
  assert.equal(normalizeInviteCode(null), "");
});

test("buildCreateOrgAction validates name", () => {
  assert.deepEqual(buildCreateOrgAction(" Acme "), { type: "create_org", companyName: "Acme" });
  assert.throws(() => buildCreateOrgAction(""), /Organization name is required/);
});

test("buildJoinOrgAction validates invite code and normalizes", () => {
  assert.deepEqual(buildJoinOrgAction("  AbC123 "), { type: "join_org", inviteCode: "abc123" });
  assert.throws(() => buildJoinOrgAction(" "), /Invite code is required/);
});

test("pending onboarding save/load/clear", () => {
  const storage = createMemoryStorage();
  const action = { type: "join_org", inviteCode: "abc123", expectedEmail: "user@example.com" };
  savePendingOnboarding(action, storage);
  assert.deepEqual(loadPendingOnboarding(storage), action);
  clearPendingOnboarding(storage);
  assert.equal(loadPendingOnboarding(storage), null);
});

test("pending onboarding load handles invalid JSON", () => {
  const storage = createMemoryStorage({ "clm:onboarding:pending": "not json" });
  assert.equal(loadPendingOnboarding(storage), null);
});
