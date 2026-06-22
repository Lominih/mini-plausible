import { describe, it, expect } from "vitest";
import { compressResponse } from "@/lib/compression";

describe("compression", () => {
  it("returns null for small body", () => {
    expect(compressResponse("hi")).toBeNull();
  });
  it("compresses large body", () => {
    const large = "x".repeat(2000);
    const result = compressResponse(large);
    expect(result).not.toBeNull();
    expect(result!.encoding).toBe("gzip");
    expect(result!.body.length).toBeLessThan(large.length);
  });
});