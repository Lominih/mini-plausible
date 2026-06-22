import { describe, it, expect } from "vitest";
import { recordFailedAttempt, isLocked, resetAttempts } from "@/lib/account-lockout";

describe("account-lockout", () => {
  it("tracks failed attempts", () => {
    const r = recordFailedAttempt("test@example.com");
    expect(r.locked).toBe(false);
    expect(r.attemptsRemaining).toBe(4);
  });
  it("locks after 5 attempts", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("lock@example.com");
    expect(isLocked("lock@example.com")).toBe(true);
  });
  it("resetAttempts clears", () => {
    for (let i = 0; i < 3; i++) recordFailedAttempt("reset@example.com");
    resetAttempts("reset@example.com");
    expect(isLocked("reset@example.com")).toBe(false);
  });
  it("isLocked returns false for unknown", () => {
    expect(isLocked("unknown@example.com")).toBe(false);
  });
});