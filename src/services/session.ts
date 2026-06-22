import { PrismaClient } from "@prisma/client";

export interface SessionData {
  sessionId: string;
  siteId: string;
  deviceId: string;
  firstVisit: Date;
  lastSeen: Date;
  pagesViewed: string[];
  referrer: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  isActive: boolean;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_SESSIONS_PER_DEVICE = 100;

export class SessionService {
  private sessionCache = new Map<string, SessionData>();

  constructor(private prisma: PrismaClient) {}

  async processEvent(eventData: {
    sessionId: string;
    siteId: string;
    deviceId: string;
    url: string;
    referrer?: string;
    browser?: string;
    os?: string;
    country?: string;
    city?: string;
    screenWidth?: number;
    screenHeight?: number;
    timestamp?: Date;
  }): Promise<SessionData> {
    const now = eventData.timestamp ?? new Date();
    const existing = this.sessionCache.get(eventData.sessionId);

    if (existing) {
      return this.updateSession(existing, eventData, now);
    }

    const dbSession = await this.prisma.session.findUnique({
      where: { id: eventData.sessionId },
    });

    if (dbSession) {
      const hydrated: SessionData = {
        sessionId: dbSession.id,
        siteId: dbSession.siteId,
        deviceId: dbSession.deviceId,
        firstVisit: dbSession.firstVisit,
        lastSeen: dbSession.lastSeen,
        pagesViewed: JSON.parse(dbSession.pagesViewed as string),
        referrer: dbSession.referrer,
        browser: dbSession.browser,
        os: dbSession.os,
        country: dbSession.country,
        city: dbSession.city,
        screenWidth: dbSession.screenWidth,
        screenHeight: dbSession.screenHeight,
        isActive: true,
      };

      this.sessionCache.set(eventData.sessionId, hydrated);
      return this.updateSession(hydrated, eventData, now);
    }

    return this.createSession(eventData, now);
  }

  private async createSession(
    eventData: {
      sessionId: string;
      siteId: string;
      deviceId: string;
      url: string;
      referrer?: string;
      browser?: string;
      os?: string;
      country?: string;
      city?: string;
      screenWidth?: number;
      screenHeight?: number;
    },
    now: Date,
  ): Promise<SessionData> {
    const session: SessionData = {
      sessionId: eventData.sessionId,
      siteId: eventData.siteId,
      deviceId: eventData.deviceId,
      firstVisit: now,
      lastSeen: now,
      pagesViewed: [eventData.url],
      referrer: eventData.referrer ?? null,
      browser: eventData.browser ?? null,
      os: eventData.os ?? null,
      country: eventData.country ?? null,
      city: eventData.city ?? null,
      screenWidth: eventData.screenWidth ?? null,
      screenHeight: eventData.screenHeight ?? null,
      isActive: true,
    };

    await this.prisma.session.create({
      data: {
        id: session.sessionId,
        siteId: session.siteId,
        deviceId: session.deviceId,
        firstVisit: session.firstVisit,
        lastSeen: session.lastSeen,
        pagesViewed: JSON.stringify(session.pagesViewed),
        referrer: session.referrer,
        browser: session.browser,
        os: session.os,
        country: session.country,
        city: session.city,
        screenWidth: session.screenWidth,
        screenHeight: session.screenHeight,
      },
    });

    this.sessionCache.set(eventData.sessionId, session);
    this.evictOldSessions();

    return session;
  }

  private async updateSession(
    session: SessionData,
    eventData: {
      url: string;
      referrer?: string;
      browser?: string;
      os?: string;
      country?: string;
      city?: string;
      screenWidth?: number;
      screenHeight?: number;
    },
    now: Date,
  ): Promise<SessionData> {
    const timeSinceLastSeen = now.getTime() - session.lastSeen.getTime();

    if (timeSinceLastSeen > SESSION_TIMEOUT_MS) {
      return this.createSession(
        {
          sessionId: `${session.siteId}-${session.deviceId}-${now.getTime()}`,
          siteId: session.siteId,
          deviceId: session.deviceId,
          url: eventData.url,
          referrer: eventData.referrer,
          browser: eventData.browser,
          os: eventData.os,
          country: eventData.country,
          city: eventData.city,
          screenWidth: eventData.screenWidth,
          screenHeight: eventData.screenHeight,
        },
        now,
      );
    }

    if (!session.pagesViewed.includes(eventData.url)) {
      session.pagesViewed.push(eventData.url);
    }
    session.lastSeen = now;

    if (eventData.referrer && !session.referrer) {
      session.referrer = eventData.referrer;
    }

    await this.prisma.session.update({
      where: { id: session.sessionId },
      data: {
        lastSeen: session.lastSeen,
        pagesViewed: JSON.stringify(session.pagesViewed),
      },
    });

    return session;
  }

  private evictOldSessions(): void {
    if (this.sessionCache.size <= MAX_SESSIONS_PER_DEVICE) return;

    const entries = Array.from(this.sessionCache.entries());
    entries.sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime());

    const toRemove = entries.slice(0, entries.length - MAX_SESSIONS_PER_DEVICE);
    for (const [key] of toRemove) {
      this.sessionCache.delete(key);
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const cached = this.sessionCache.get(sessionId);
    if (cached) return cached;

    const dbSession = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!dbSession) return null;

    const session: SessionData = {
      sessionId: dbSession.id,
      siteId: dbSession.siteId,
      deviceId: dbSession.deviceId,
      firstVisit: dbSession.firstVisit,
      lastSeen: dbSession.lastSeen,
      pagesViewed: JSON.parse(dbSession.pagesViewed as string),
      referrer: dbSession.referrer,
      browser: dbSession.browser,
      os: dbSession.os,
      country: dbSession.country,
      city: dbSession.city,
      screenWidth: dbSession.screenWidth,
      screenHeight: dbSession.screenHeight,
      isActive:
        Date.now() - dbSession.lastSeen.getTime() < SESSION_TIMEOUT_MS,
    };

    this.sessionCache.set(sessionId, session);
    return session;
  }

  async getActiveSessions(siteId: string): Promise<SessionData[]> {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);

    const dbSessions = await this.prisma.session.findMany({
      where: {
        siteId,
        lastSeen: { gte: cutoff },
      },
    });

    return dbSessions.map((s) => ({
      sessionId: s.id,
      siteId: s.siteId,
      deviceId: s.deviceId,
      firstVisit: s.firstVisit,
      lastSeen: s.lastSeen,
      pagesViewed: JSON.parse(s.pagesViewed as string),
      referrer: s.referrer,
      browser: s.browser,
      os: s.os,
      country: s.country,
      city: s.city,
      screenWidth: s.screenWidth,
      screenHeight: s.screenHeight,
      isActive: true,
    }));
  }

  async getVisitorSessions(
    siteId: string,
    deviceId: string,
    limit: number = 50,
  ): Promise<SessionData[]> {
    const dbSessions = await this.prisma.session.findMany({
      where: { siteId, deviceId },
      orderBy: { firstVisit: 'desc' },
      take: limit,
    });

    return dbSessions.map((s) => ({
      sessionId: s.id,
      siteId: s.siteId,
      deviceId: s.deviceId,
      firstVisit: s.firstVisit,
      lastSeen: s.lastSeen,
      pagesViewed: JSON.parse(s.pagesViewed as string),
      referrer: s.referrer,
      browser: s.browser,
      os: s.os,
      country: s.country,
      city: s.city,
      screenWidth: s.screenWidth,
      screenHeight: s.screenHeight,
      isActive:
        Date.now() - s.lastSeen.getTime() < SESSION_TIMEOUT_MS,
    }));
  }
}

