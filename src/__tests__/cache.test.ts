import { describe, it, expect, vi, beforeEach } from "vitest";

// Simple in-memory cache module test
describe("analytics cache", () => {
  const cache = new Map<string, { data: unknown; expires: number }>();

  function setCache(key: string, data: unknown, ttlMs: number) {
    cache.set(key, { data, expires: Date.now() + ttlMs });
  }

  function getCache(key: string) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  beforeEach(() => cache.clear());

  it("stores and retrieves data", () => {
    setCache("key1", { views: 100 }, 60000);
    expect(getCache("key1")).toEqual({ views: 100 });
  });

  it("returns null for missing keys", () => {
    expect(getCache("nonexistent")).toBeNull();
  });

  it("returns null for expired entries", () => {
    setCache("key2", "data", -1);
    expect(getCache("key2")).toBeNull();
  });

  it("overwrites existing entries", () => {
    setCache("key3", "old", 60000);
    setCache("key3", "new", 60000);
    expect(getCache("key3")).toBe("new");
  });

  it("handles different data types", () => {
    setCache("str", "hello", 60000);
    setCache("num", 42, 60000);
    setCache("arr", [1, 2, 3], 60000);
    setCache("obj", { a: 1 }, 60000);
    expect(getCache("str")).toBe("hello");
    expect(getCache("num")).toBe(42);
    expect(getCache("arr")).toEqual([1, 2, 3]);
    expect(getCache("obj")).toEqual({ a: 1 });
  });

  it("clears all entries", () => {
    setCache("a", 1, 60000);
    setCache("b", 2, 60000);
    cache.clear();
    expect(getCache("a")).toBeNull();
    expect(getCache("b")).toBeNull();
  });
});