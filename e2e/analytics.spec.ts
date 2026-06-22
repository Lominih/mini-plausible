import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function setupSite(request: any) {
  const uniqueId = Date.now() + Math.random().toString(36).slice(2, 8);
  const email = `e2e-analytics-${uniqueId}@test.com`;

  const registerRes = await request.post("/api/auth/register", {
    data: { email, password: "testpass123", name: "E2E Test User" },
  });
  expect(registerRes.ok()).toBeTruthy();
  const { accessToken } = await registerRes.json();

  const siteRes = await request.post("/api/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: "E2E Test Site", domain: `e2e-${uniqueId}.test.com`, timezone: "UTC" },
  });
  expect(siteRes.ok()).toBeTruthy();
  const site = await siteRes.json();

  return { accessToken, siteId: site.id, domain: site.domain };
}

async function sendEvent(request: any, siteId: string, eventName: string, url: string) {
  const res = await request.post("/api/event", {
    headers: { "x-site-id": siteId },
    data: { name: eventName, url },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe("Analytics Dashboard & Data Collection", () => {
  test("collects events via /api/event and reports them in realtime", async ({ request }) => {
    const { siteId } = await setupSite(request);

    await sendEvent(request, siteId, "pageview", "https://test.com/");
    await sendEvent(request, siteId, "pageview", "https://test.com/pricing");
    await sendEvent(request, siteId, "click", "https://test.com/pricing");

    const realtimeRes = await request.get(`/api/analytics/realtime?siteId=${siteId}`);
    expect(realtimeRes.ok()).toBeTruthy();
    const realtime = await realtimeRes.json();
    expect(realtime).toHaveProperty("onlineVisitors");
    expect(realtime).toHaveProperty("pageviewsLast5Min");
    expect(realtime.pageviewsLast5Min).toBeGreaterThanOrEqual(3);
  });

  test("batch event ingestion via /api/events", async ({ request }) => {
    const { siteId } = await setupSite(request);

    const batchRes = await request.post("/api/events", {
      headers: { "x-site-id": siteId },
      data: [
        { name: "pageview", url: "https://test.com/" },
        { name: "signup", url: "https://test.com/signup", props: { plan: "free" } },
        { name: "purchase", url: "https://test.com/checkout", props: { amount: 99 } },
      ],
    });
    expect(batchRes.ok()).toBeTruthy();
    const batch = await batchRes.json();
    expect(batch.success).toBe(true);
    expect(batch.eventIds).toHaveLength(3);
    expect(batch.errors).toHaveLength(0);
  });

  test("visitors over time returns time series", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/visitors?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const series = await res.json();
    expect(Array.isArray(series)).toBe(true);
  });

  test("pageviews over time returns time series", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/pageviews?siteId=${siteId}&period=7d`);
    expect(res.ok()).toBeTruthy();
    const series = await res.json();
    expect(Array.isArray(series)).toBe(true);
  });

  test("top pages breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");
    await sendEvent(request, siteId, "pageview", "https://test.com/");
    await sendEvent(request, siteId, "pageview", "https://test.com/pricing");

    const res = await request.get(`/api/analytics/pages?siteId=${siteId}&period=30d&limit=5`);
    expect(res.ok()).toBeTruthy();
    const pages = await res.json();
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]).toHaveProperty("name");
    expect(pages[0]).toHaveProperty("count");
    expect(pages[0]).toHaveProperty("percentage");
  });

  test("top referrers breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/referrers?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const referrers = await res.json();
    expect(Array.isArray(referrers)).toBe(true);
  });

  test("browser breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/browsers?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const browsers = await res.json();
    expect(Array.isArray(browsers)).toBe(true);
    if (browsers.length > 0) {
      expect(browsers[0]).toHaveProperty("name");
      expect(browsers[0]).toHaveProperty("count");
      expect(browsers[0]).toHaveProperty("percentage");
    }
  });

  test("OS breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/os?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const os = await res.json();
    expect(Array.isArray(os)).toBe(true);
  });

  test("devices breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/devices?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const devices = await res.json();
    expect(Array.isArray(devices)).toBe(true);
  });

  test("countries breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/countries?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const countries = await res.json();
    expect(Array.isArray(countries)).toBe(true);
  });

  test("entry pages breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/entry-pages?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const pages = await res.json();
    expect(Array.isArray(pages)).toBe(true);
  });

  test("exit pages breakdown", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/exit-pages?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const pages = await res.json();
    expect(Array.isArray(pages)).toBe(true);
  });

  test("UTM breakdown by source", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await request.post("/api/event", {
      headers: { "x-site-id": siteId },
      data: { name: "pageview", url: "https://test.com/", utm: { utm_source: "twitter", utm_medium: "social" } },
    });

    const res = await request.get(`/api/analytics/utm?siteId=${siteId}&period=30d&group_by=utm_source`);
    expect(res.ok()).toBeTruthy();
    const utm = await res.json();
    expect(Array.isArray(utm)).toBe(true);
  });

  test("bounce rate over time", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/bounce-rate?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const series = await res.json();
    expect(Array.isArray(series)).toBe(true);
  });

  test("visit duration over time", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/visit-duration?siteId=${siteId}&period=30d`);
    expect(res.ok()).toBeTruthy();
    const series = await res.json();
    expect(Array.isArray(series)).toBe(true);
  });

  test("comparison mode returns current and previous periods", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await sendEvent(request, siteId, "pageview", "https://test.com/");

    const res = await request.get(`/api/analytics/visitors?siteId=${siteId}&period=30d&compare=true`);
    expect(res.ok()).toBeTruthy();
    const result = await res.json();
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("previous");
    expect(result).toHaveProperty("change");
    expect(result).toHaveProperty("changePercentage");
    expect(Array.isArray(result.current)).toBe(true);
    expect(Array.isArray(result.previous)).toBe(true);
  });

  test("filters narrow results", async ({ request }) => {
    const { siteId } = await setupSite(request);
    await request.post("/api/event", {
      headers: { "x-site-id": siteId },
      data: { name: "pageview", url: "https://test.com/", screenWidth: 1920 },
    });

    const res = await request.get(`/api/analytics/pages?siteId=${siteId}&period=30d&filters=browser:Playwright`);
    expect(res.ok()).toBeTruthy();
    const pages = await res.json();
    expect(Array.isArray(pages)).toBe(true);
  });

  test("missing siteId returns 400", async ({ request }) => {
    const res = await request.get("/api/analytics/realtime");
    expect(res.status()).toBe(400);
  });
});
