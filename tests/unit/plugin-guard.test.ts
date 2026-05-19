import { describe, expect, test } from "bun:test";
import { looksLikeCompletionClaim, looksLikeStopEarlyOrConfirmation, shouldWarnForMissingVerification, VERIFICATION_WARNING } from "../../src/plugin/hooks/jce-worker-guard.ts";

describe("JCE-Worker guard", () => {
  test("warns when completion claim lacks verification evidence", () => {
    const text = "Implemented the fix and everything is complete.";
    expect(shouldWarnForMissingVerification(text)).toBe(true);
    expect(VERIFICATION_WARNING).toContain("verification");
  });

  test("does not warn when verification evidence is present", () => {
    const text = "Implemented the fix. Verification: bun test (pass), bun run typecheck (pass).";
    expect(shouldWarnForMissingVerification(text)).toBe(false);
  });

  test("detects Indonesian completion and confirmation-stop language", () => {
    expect(looksLikeCompletionClaim("Sudah selesai dan beres.")).toBe(true);
    expect(looksLikeStopEarlyOrConfirmation("Sisanya tinggal dikonfirmasi dulu ya.")).toBe(true);
    expect(looksLikeStopEarlyOrConfirmation("Saya berhenti di sini dulu, lanjut nanti.")).toBe(true);
  });
});
