import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RealtimeCounter } from "@/services/realtime";

describe("RealtimeCounter", () => {
  let counter: RealtimeCounter;

  beforeEach(() => {
    counter = new RealtimeCounter();
  });

  afterEach(() => {
    counter.stop();
  });

  it("starts with zero visitors", () => {
    expect(counter.getCurrentVisitors()).toBe(0);
  });

  it("tracks a page view", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    expect(counter.getCurrentVisitors()).toBe(1);
  });

  it("deduplicates same device", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    counter.trackPageView("/about", "d1", "s1", "site1");
    expect(counter.getCurrentVisitors()).toBe(1);
  });

  it("counts distinct devices", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    counter.trackPageView("/about", "d2", "s2", "site1");
    counter.trackPageView("/contact", "d3", "s3", "site1");
    expect(counter.getCurrentVisitors()).toBe(3);
  });

  it("getTopPagesNow returns pages sorted by count", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    counter.trackPageView("/home", "d2", "s2", "site1");
    counter.trackPageView("/about", "d3", "s3", "site1");
    const top = counter.getTopPagesNow(10);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].url).toBe("/home");
    expect(top[0].count).toBe(2);
  });

  it("getTopPagesNow respects limit", () => {
    counter.trackPageView("/a", "d1", "s1", "site1");
    counter.trackPageView("/b", "d2", "s2", "site1");
    counter.trackPageView("/c", "d3", "s3", "site1");
    const top = counter.getTopPagesNow(2);
    expect(top).toHaveLength(2);
  });

  it("getSnapshot returns an object", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    const snap = counter.getSnapshot();
    expect(snap).toBeDefined();
    expect(typeof snap).toBe("object");
  });

  it("getPageviewsPerMinute returns a number", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    const ppm = counter.getPageviewsPerMinute();
    expect(typeof ppm).toBe("number");
    expect(ppm).toBeGreaterThanOrEqual(0);
  });

  it("getWindowStats returns stats", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    const stats = counter.getWindowStats(Date.now(), 60000);
    expect(stats).toBeDefined();
    expect(typeof stats).toBe("object");
  });

  it("stop does not throw", () => {
    counter.trackPageView("/home", "d1", "s1", "site1");
    expect(() => counter.stop()).not.toThrow();
  });

  it("tracks pageview counts correctly", () => {
    counter.trackPageView("/a", "d1", "s1", "site1");
    counter.trackPageView("/a", "d2", "s2", "site1");
    counter.trackPageView("/b", "d3", "s3", "site1");
    const top = counter.getTopPagesNow(10);
    const aPage = top.find(p => p.url === "/a");
    expect(aPage?.count).toBe(2);
  });
});