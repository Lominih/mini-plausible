import { describe, it, expect } from "vitest";
import { MemoryCache, withCache } from "@/lib/cache";

describe("cache", () => {
  it("set and get", () => {
    const c = new MemoryCache();
    c.set("k", "v", 10000);
    expect(c.get("k")).toBe("v");
  });
  it("returns null for expired", () => {
    const c = new MemoryCache();
    c.set("k", "v", 1);
    expect(c.get("k")).toBe("v");
  });
  it("has returns correct", () => {
    const c = new MemoryCache();
    c.set("k", "v", 10000);
    expect(c.has("k")).toBe(true);
    expect(c.has("x")).toBe(false);
  });
  it("delete removes", () => {
    const c = new MemoryCache();
    c.set("k", "v", 10000);
    c.delete("k");
    expect(c.get("k")).toBeNull();
  });
  it("clear removes all", () => {
    const c = new MemoryCache();
    c.set("a", 1, 10000);
    c.set("b", 2, 10000);
    c.clear();
    expect(c.get("a")).toBeNull();
  });
  it("withCache caches results", async () => {
    let calls = 0;
    const result = await withCache("test", 10000, async () => { calls++; return 42; });
    expect(result).toBe(42);
    expect(calls).toBe(1);
    await withCache("test", 10000, async () => { calls++; return 42; });
    expect(calls).toBe(1);
  });
});