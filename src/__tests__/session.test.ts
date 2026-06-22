import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/utils/prisma", () => ({
  prisma: {
    session: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { SessionService } from "@/services/session";

function makeService() {
  return new SessionService({
    session: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      findMany: mockFindMany,
    },
  } as any);
}

function mockDbSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    siteId: "site1",
    visitorId: "d1",
    startedAt: new Date(),
    lastSeen: new Date(),
    duration: 0,
    pagesViewed: JSON.stringify(["/page"]),
    referrer: null,
    browser: "Chrome",
    os: "Windows",
    country: null,
    city: null,
    screenWidth: 1920,
    screenHeight: 1080,
    isActive: true,
    ...overrides,
  };
}

describe("SessionService", () => {
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
  });

  it("creates a new session when none exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockDbSession());
    const result = await service.processEvent({
      sessionId: "s1",
      siteId: "site1",
      deviceId: "d1",
      url: "/page",
      browser: "Chrome",
      os: "Windows",
    });
    expect(result).toBeDefined();
    expect(mockCreate).toHaveBeenCalled();
  });

  it("updates existing session with new page", async () => {
    mockFindUnique.mockResolvedValue(mockDbSession({ lastSeen: new Date(Date.now() - 60000) }));
    mockUpdate.mockResolvedValue({});
    const result = await service.processEvent({
      sessionId: "s1",
      siteId: "site1",
      deviceId: "d1",
      url: "/new-page",
    });
    expect(result).toBeDefined();
  });

  it("getSession returns session data", async () => {
    mockFindUnique.mockResolvedValue(mockDbSession());
    const result = await service.getSession("s1");
    expect(result).toBeDefined();
    expect(result?.sessionId).toBe("s1");
  });

  it("getSession returns null when not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await service.getSession("nonexistent");
    expect(result).toBeNull();
  });

  it("getActiveSessions returns active sessions", async () => {
    mockFindMany.mockResolvedValue([mockDbSession({ id: "s1" }), mockDbSession({ id: "s2" })]);
    const result = await service.getActiveSessions("site1");
    expect(result).toHaveLength(2);
  });

  it("getVisitorSessions returns sessions for a device", async () => {
    mockFindMany.mockResolvedValue([mockDbSession()]);
    const result = await service.getVisitorSessions("site1", "d1");
    expect(result).toHaveLength(1);
  });

  it("processEvent handles referrer", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockDbSession());
    const result = await service.processEvent({
      sessionId: "s1",
      siteId: "site1",
      deviceId: "d1",
      url: "/page",
      referrer: "https://google.com",
    });
    expect(result).toBeDefined();
  });
});