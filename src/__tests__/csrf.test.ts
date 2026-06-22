import { describe, it, expect } from "vitest";
import { generateCsrfToken, validateCsrfToken } from "@/lib/csrf";

describe("csrf", () => {
  it("generates 64-char hex token", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });
  it("generates unique tokens", () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
  it("validates correct token", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });
  it("rejects tampered token", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token + "a", token)).toBe(false);
  });
  it("rejects empty token", () => {
    expect(validateCsrfToken("", "secret")).toBe(false);
  });
  it("rejects wrong secret", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, "wrong")).toBe(false);
  });
});