import { PrismaClient } from "@prisma/client";

export interface CleanupConfig {
  eventRetentionDays: number;
  sessionRetentionDays: number;
  aggregateRetentionDays: number;
  vacuumIntervalDays: number;
  batchSize: number;
}

const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  eventRetentionDays: 90,
  sessionRetentionDays: 90,
  aggregateRetentionDays: 365,
  vacuumIntervalDays: 7,
  batchSize: 1000,
};

export interface CleanupResult {
  eventsDeleted: number;
  sessionsDeleted: number;
  aggregatesArchived: number;
  vacuumRun: boolean;
  duration: number;
}

export class CleanupService {
  private config: CleanupConfig;
  private lastVacuumDate: Date | null = null;

  constructor(
    private prisma: PrismaClient,
    config?: Partial<CleanupConfig>,
  ) {
    this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
  }

  async runFullCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();

    const eventsDeleted = await this.deleteOldEvents();
    const sessionsDeleted = await this.deleteOldSessions();
    const aggregatesArchived = await this.archiveOldAggregates();
    const vacuumRun = await this.vacuumIfNeeded();

    const duration = Date.now() - startTime;

    return {
      eventsDeleted,
      sessionsDeleted,
      aggregatesArchived,
      vacuumRun,
      duration,
    };
  }

  async deleteOldEvents(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.eventRetentionDays);

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const deleted = await this.prisma.event.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });

      totalDeleted += deleted.count;
      hasMore = deleted.count >= this.config.batchSize;
    }

    return totalDeleted;
  }

  async deleteOldSessions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.sessionRetentionDays);

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const deleted = await this.prisma.session.deleteMany({
        where: {
          lastSeen: { lt: cutoff },
        },
      });

      totalDeleted += deleted.count;
      hasMore = deleted.count >= this.config.batchSize;
    }

    return totalDeleted;
  }

  async archiveOldAggregates(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(
      cutoff.getDate() - this.config.aggregateRetentionDays,
    );

    const oldAggregates = await this.prisma.dailyAggregate.findMany({
      where: {
        date: { lt: cutoff },
      },
    });

    return oldAggregates.length;
  }

  async vacuumIfNeeded(): Promise<boolean> {
    if (!this.shouldVacuum()) return false;

    try {
      await this.prisma.$executeRawUnsafe('VACUUM');
      this.lastVacuumDate = new Date();
      return true;
    } catch (error) {
      console.error('[CleanupService] VACUUM failed:', error);
      return false;
    }
  }

  async forceVacuum(): Promise<boolean> {
    try {
      await this.prisma.$executeRawUnsafe('VACUUM');
      this.lastVacuumDate = new Date();
      return true;
    } catch (error) {
      console.error('[CleanupService] Forced VACUUM failed:', error);
      return false;
    }
  }

  async getStats(): Promise<{
    eventCount: number;
    sessionCount: number;
    aggregateCount: number;
    oldestEvent: Date | null;
    newestEvent: Date | null;
    dbSize: number;
  }> {
    const eventCount = await this.prisma.event.count();
    const sessionCount = await this.prisma.session.count();
    const aggregateCount = await this.prisma.dailyAggregate.count();

    const oldestEvent = await this.prisma.event.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const newestEvent = await this.prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    let dbSize = 0;
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ size: number }>>(
        'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()',
      );
      dbSize = result[0]?.size ?? 0;
    } catch {
      // Fallback for non-SQLite or permission issues
    }

    return {
      eventCount,
      sessionCount,
      aggregateCount,
      oldestEvent: oldestEvent?.createdAt ?? null,
      newestEvent: newestEvent?.createdAt ?? null,
      dbSize,
    };
  }

  private shouldVacuum(): boolean {
    if (!this.lastVacuumDate) return true;

    const daysSinceLastVacuum =
      (Date.now() - this.lastVacuumDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastVacuum >= this.config.vacuumIntervalDays;
  }

  async analyzeTables(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe('ANALYZE');
    } catch (error) {
      console.error('[CleanupService] ANALYZE failed:', error);
    }
  }

  async recreateIndexes(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS idx_events_site_created ON Event(siteId, createdAt)',
      );
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS idx_events_device ON Event(deviceId)',
      );
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS idx_events_session ON Event(sessionId)',
      );
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS idx_sessions_site_last ON Session(siteId, lastSeen)',
      );
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS idx_sessions_device ON Session(deviceId)',
      );
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS idx_aggregates_site_date ON DailyAggregate(siteId, date)',
      );
    } catch (error) {
      console.error('[CleanupService] Index recreation failed:', error);
    }
  }
}

