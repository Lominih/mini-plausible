import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeInput, validateAndSanitize } from "@/lib/sanitize";
import { z } from "zod";

describe("sanitize", () => {
  it("sanitizeHtml escapes special chars", () => {
    expect(sanitizeHtml('<script>alert("x")</script>')).toContain("&lt;script&gt;");
  });
  it("sanitizeInput trims and limits", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
    expect(sanitizeInput("x".repeat(15000))).toHaveLength(10000);
  });
  it("validateAndSanitize works with Zod", () => {
    const schema = z.object({ name: z.string() });
    const result = validateAndSanitize(schema, { name: "test" });
    expect(result.success).toBe(true);
  });
  it("validateAndSanitize returns errors", () => {
    const schema = z.object({ name: z.string() });
    const result = validateAndSanitize(schema, { name: 123 });
    expect(result.success).toBe(false);
  });
});