import { test, expect } from "@playwright/test";

test.describe("Health Endpoint", () => {
  test("GET /health returns status ok", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("uptime");
  });
});

test.describe("Authentication", () => {
  const uniqueId = Date.now().toString(36);
  const testEmail = `e2e-auth-${uniqueId}@test.com`;
  const testPassword = "securepass123";

  test("POST /api/auth/register creates a new user", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: { email: testEmail, password: testPassword, name: "E2E User" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.name).toBe("E2E User");
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    expect(body.user).not.toHaveProperty("password");
  });

  test("POST /api/auth/register rejects duplicate email", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: { email: testEmail, password: testPassword },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already registered");
  });

  test("POST /api/auth/register rejects invalid email", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: { email: "not-an-email", password: testPassword },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/auth/register rejects short password", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: { email: "short-pass-test@test.com", password: "123" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/auth/login returns tokens", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: testEmail, password: testPassword },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.email).toBe(testEmail);
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
  });

  test("POST /api/auth/login rejects wrong password", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: testEmail, password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/login rejects nonexistent user", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "nobody@test.com", password: "anything" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/refresh exchanges refresh token", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { email: testEmail, password: testPassword },
    });
    const { refreshToken } = await loginRes.json();

    const res = await request.post("/api/auth/refresh", { data: { refreshToken } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
  });

  test("POST /api/auth/refresh rejects invalid token", async ({ request }) => {
    const res = await request.post("/api/auth/refresh", {
      data: { refreshToken: "invalid.token.here" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/auth/me returns user profile", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { email: testEmail, password: testPassword },
    });
    const { accessToken } = await loginRes.json();

    const res = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.email).toBe(testEmail);
    expect(body.user._count).toHaveProperty("sites");
  });

  test("GET /api/auth/me rejects unauthenticated request", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(401);
  });
});

test.describe("Users", () => {
  let accessToken: string;
  const uniqueId = Date.now().toString(36);
  const testEmail = `e2e-users-${uniqueId}@test.com`;

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: { email: testEmail, password: "securepass123", name: "User Test" },
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  test("GET /api/users/me returns profile", async ({ request }) => {
    const res = await request.get("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.email).toBe(testEmail);
  });

  test("PUT /api/users/me updates name", async ({ request }) => {
    const res = await request.put("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Updated Name" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.name).toBe("Updated Name");
  });

  test("PUT /api/users/me updates password", async ({ request }) => {
    const res = await request.put("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { currentPassword: "securepass123", newPassword: "newpass456" },
    });
    expect(res.ok()).toBeTruthy();

    const loginRes = await request.post("/api/auth/login", {
      data: { email: testEmail, password: "newpass456" },
    });
    expect(loginRes.ok()).toBeTruthy();
  });

  test("PUT /api/users/me rejects wrong current password", async ({ request }) => {
    const res = await request.put("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { currentPassword: "wrongold", newPassword: "newpass789" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Sites", () => {
  let accessToken: string;
  let siteId: string;
  const uniqueId = Date.now().toString(36);
  const testEmail = `e2e-sites-${uniqueId}@test.com`;
  const testDomain = `e2e-${uniqueId}.test.com`;

  test.beforeAll(async ({ request }) => {
    const regRes = await request.post("/api/auth/register", {
      data: { email: testEmail, password: "securepass123", name: "Site Test" },
    });
    const regBody = await regRes.json();
    accessToken = regBody.accessToken;
  });

  test("POST /api/sites creates a site", async ({ request }) => {
    const res = await request.post("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "E2E Site", domain: testDomain, timezone: "UTC" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("E2E Site");
    expect(body.domain).toBe(testDomain);
    siteId = body.id;
  });

  test("GET /api/sites lists sites", async ({ request }) => {
    const res = await request.get("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((s: any) => s.domain === testDomain)).toBe(true);
  });

  test("GET /api/sites/:id returns site details with members", async ({ request }) => {
    const res = await request.get(`/api/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe(siteId);
    expect(body).toHaveProperty("members");
    expect(body.members.length).toBeGreaterThanOrEqual(1);
  });

  test("PUT /api/sites/:id updates site", async ({ request }) => {
    const res = await request.put(`/api/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Updated E2E Site" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe("Updated E2E Site");
  });

  test("GET /api/sites/:id/stats returns stats", async ({ request }) => {
    const res = await request.get(`/api/sites/${siteId}/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("today");
    expect(body).toHaveProperty("last30Days");
    expect(body).toHaveProperty("totalEventsTracked");
  });

  test("GET /api/sites/:id/embed returns embed code", async ({ request }) => {
    const res = await request.get(`/api/sites/${siteId}/embed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("embedCode");
    expect(body.embedCode).toContain("script");
  });

  test("POST /api/sites/:id/members invites a member", async ({ request }) => {
    const user2Email = `e2e-member-${uniqueId}@test.com`;
    const regRes = await request.post("/api/auth/register", {
      data: { email: user2Email, password: "securepass123" },
    });
    expect(regRes.ok()).toBeTruthy();

    const res = await request.post(`/api/sites/${siteId}/members`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { email: user2Email, role: "viewer" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("viewer");
    expect(body.user.email).toBe(user2Email);
  });

  test("POST /api/sites rejects duplicate domain", async ({ request }) => {
    const res = await request.post("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Dup", domain: testDomain },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe("Funnels", () => {
  let accessToken: string;
  let siteId: string;

  test.beforeAll(async ({ request }) => {
    const uniqueId = Date.now().toString(36);
    const email = `e2e-funnels-${uniqueId}@test.com`;

    const regRes = await request.post("/api/auth/register", {
      data: { email, password: "securepass123" },
    });
    const regBody = await regRes.json();
    accessToken = regBody.accessToken;

    const siteRes = await request.post("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Funnel Site", domain: `funnel-${uniqueId}.test.com` },
    });
    const siteBody = await siteRes.json();
    siteId = siteBody.id;
  });

  test("POST /api/analytics/funnels creates a funnel", async ({ request }) => {
    const res = await request.post("/api/analytics/funnels", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { siteId, name: "Signup Flow", steps: [{ type: "page", value: "/" }, { type: "event", value: "signup" }] },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.funnel.name).toBe("Signup Flow");
    expect(body.funnel.steps).toHaveLength(2);
  });

  test("GET /api/analytics/funnels lists funnels", async ({ request }) => {
    const res = await request.get(`/api/analytics/funnels?siteId=${siteId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.funnels.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/analytics/funnels rejects with fewer than 2 steps", async ({ request }) => {
    const res = await request.post("/api/analytics/funnels", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { siteId, name: "Bad Funnel", steps: [{ type: "page", value: "/" }] },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("User Paths", () => {
  let accessToken: string;
  let siteId: string;

  test.beforeAll(async ({ request }) => {
    const uniqueId = Date.now().toString(36);
    const email = `e2e-paths-${uniqueId}@test.com`;

    const regRes = await request.post("/api/auth/register", {
      data: { email, password: "securepass123" },
    });
    const regBody = await regRes.json();
    accessToken = regBody.accessToken;

    const siteRes = await request.post("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Paths Site", domain: `paths-${uniqueId}.test.com` },
    });
    const siteBody = await siteRes.json();
    siteId = siteBody.id;
  });

  test("GET /api/analytics/paths returns path analysis", async ({ request }) => {
    const res = await request.get(`/api/analytics/paths?siteId=${siteId}&limit=10`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("paths");
    expect(Array.isArray(body.paths)).toBe(true);
  });
});

test.describe("Event Definitions", () => {
  let accessToken: string;
  let siteId: string;
  let defId: string;

  test.beforeAll(async ({ request }) => {
    const uniqueId = Date.now().toString(36);
    const email = `e2e-defs-${uniqueId}@test.com`;

    const regRes = await request.post("/api/auth/register", {
      data: { email, password: "securepass123" },
    });
    const regBody = await regRes.json();
    accessToken = regBody.accessToken;

    const siteRes = await request.post("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Defs Site", domain: `defs-${uniqueId}.test.com` },
    });
    const siteBody = await siteRes.json();
    siteId = siteBody.id;
  });

  test("POST /api/events/definitions creates a definition", async ({ request }) => {
    const res = await request.post("/api/events/definitions", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { siteId, name: "signup", propertiesSchema: { plan: "string", referral: "string" } },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.definition.name).toBe("signup");
    defId = body.definition.id;
  });

  test("GET /api/events/definitions lists definitions", async ({ request }) => {
    const res = await request.get(`/api/events/definitions?siteId=${siteId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.definitions.length).toBeGreaterThanOrEqual(1);
  });

  test("PUT /api/events/definitions/:id updates a definition", async ({ request }) => {
    const res = await request.put(`/api/events/definitions/${defId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "signup_v2" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.definition.name).toBe("signup_v2");
  });

  test("DELETE /api/events/definitions/:id deletes a definition", async ({ request }) => {
    const res = await request.delete(`/api/events/definitions/${defId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.message).toContain("deleted");
  });
});

test.describe("Data Export", () => {
  let accessToken: string;
  let siteId: string;

  test.beforeAll(async ({ request }) => {
    const uniqueId = Date.now().toString(36);
    const email = `e2e-export-${uniqueId}@test.com`;

    const regRes = await request.post("/api/auth/register", {
      data: { email, password: "securepass123" },
    });
    const regBody = await regRes.json();
    accessToken = regBody.accessToken;

    const siteRes = await request.post("/api/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "Export Site", domain: `export-${uniqueId}.test.com` },
    });
    const siteBody = await siteRes.json();
    siteId = siteBody.id;

    await request.post("/api/event", {
      headers: { "x-site-id": siteId },
      data: { name: "pageview", url: "https://test.com/" },
    });
  });

  test("GET /api/export/:siteId returns JSON export", async ({ request }) => {
    const res = await request.get(`/api/export/${siteId}?format=json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("site");
    expect(body).toHaveProperty("events");
    expect(body).toHaveProperty("pageviews");
    expect(body).toHaveProperty("exportedAt");
    expect(body.site.id).toBe(siteId);
  });

  test("GET /api/export/:siteId returns CSV export", async ({ request }) => {
    const res = await request.get(`/api/export/${siteId}?format=csv`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain("# Events");
    expect(text).toContain("# Aggregated Events");
  });
});
