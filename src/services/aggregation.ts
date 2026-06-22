import { PrismaClient } from "@prisma/client";

export interface PageStat {
  url: string;
  count: number;
}

export interface SourceStat {
  referrer: string;
  count: number;
}

export interface CountryStat {
  country: string;
  count: number;
}

export interface BrowserStat {
  browser: string;
  count: number;
}

export interface DeviceStat {
  screenWidth: string;
  count: number;
}

export interface AggregatedMetrics {
  siteId: string;
  date: Date;
  pageviews: number;
  visitors: number;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
  topPages: PageStat[];
  topSources: SourceStat[];
  countries: CountryStat[];
  browsers: BrowserStat[];
  devices: DeviceStat[];
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function bucketDevice(width: number): string {
  if (width < 768) return '<768';
  if (width < 1024) return '768-1024';
  if (width < 1440) return '1024-1440';
  return '>1440';
}

export class AggregationService {
  constructor(private prisma: PrismaClient) {}

  async aggregateHourly(siteId: string, date: Date, hour: number): Promise<AggregatedMetrics> {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);

    return this.computeMetricsForRange(siteId, start, end, new Date(date));
  }

  async aggregateDaily(siteId: string, date: Date): Promise<AggregatedMetrics> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return this.computeMetricsForRange(siteId, start, end, new Date(start));
  }

  async aggregateAndStoreDaily(siteId: string, date: Date): Promise<void> {
    const metrics = await this.aggregateDaily(siteId, date);

    await this.prisma.dailyAggregate.upsert({
      where: {
        siteId_date: { siteId, date: metrics.date },
      },
      create: {
        siteId,
        date: metrics.date,
        pageviews: metrics.pageviews,
        visitors: metrics.visitors,
        sessions: metrics.sessions,
        bounceRate: metrics.bounceRate,
        avgDuration: metrics.avgDuration,
        topPages: JSON.stringify(metrics.topPages),
        topSources: JSON.stringify(metrics.topSources),
        countries: JSON.stringify(metrics.countries),
        browsers: JSON.stringify(metrics.browsers),
        devices: JSON.stringify(metrics.devices),
      },
      update: {
        pageviews: metrics.pageviews,
        visitors: metrics.visitors,
        sessions: metrics.sessions,
        bounceRate: metrics.bounceRate,
        avgDuration: metrics.avgDuration,
        topPages: JSON.stringify(metrics.topPages),
        topSources: JSON.stringify(metrics.topSources),
        countries: JSON.stringify(metrics.countries),
        browsers: JSON.stringify(metrics.browsers),
        devices: JSON.stringify(metrics.devices),
      },
    });
  }

  async aggregateAllSites(date: Date): Promise<void> {
    const sites = await this.prisma.site.findMany({ select: { id: true } });

    for (const site of sites) {
      await this.aggregateAndStoreDaily(site.id, date);
    }
  }

  private async computeMetricsForRange(
    siteId: string,
    start: Date,
    end: Date,
    date: Date,
  ): Promise<AggregatedMetrics> {
    const events = await this.prisma.event.findMany({
      where: {
        siteId,
        createdAt: { gte: start, lt: end },
      },
    });

    const uniqueDeviceIds = new Set<string>();
    const sessionMap = new Map<string, { pageCount: number; firstEvent: Date; lastEvent: Date }>();
    const pageCount = new Map<string, number>();
    const sourceCount = new Map<string, number>();
    const countryCount = new Map<string, number>();
    const browserCount = new Map<string, number>();
    const deviceCount = new Map<string, number>();

    for (const event of events) {
      if (event.deviceId) {
        uniqueDeviceIds.add(event.deviceId);
      }

      if (event.sessionId) {
        let session = sessionMap.get(event.sessionId);
        if (!session) {
          session = { pageCount: 1, firstEvent: event.createdAt, lastEvent: event.createdAt };
          sessionMap.set(event.sessionId, session);
        } else {
          session.lastEvent = event.createdAt;
          session.pageCount++;
        }
      }

      pageCount.set(event.url, (pageCount.get(event.url) ?? 0) + 1);

      if (event.referrer) {
        sourceCount.set(event.referrer, (sourceCount.get(event.referrer) ?? 0) + 1);
      }

      if (event.country) {
        countryCount.set(event.country, (countryCount.get(event.country) ?? 0) + 1);
      }

      if (event.browser) {
        browserCount.set(event.browser, (browserCount.get(event.browser) ?? 0) + 1);
      }

      if (event.screenWidth != null) {
        const bucket = bucketDevice(event.screenWidth);
        deviceCount.set(bucket, (deviceCount.get(bucket) ?? 0) + 1);
      }
    }

    const sessions = Array.from(sessionMap.values());
    const bouncedSessions = sessions.filter((s) => s.pageCount === 1).length;
    const totalSessions = sessions.length || 1;

    const durations = sessions.map(
      (s) => (s.lastEvent.getTime() - s.firstEvent.getTime()) / 1000,
    );
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      siteId,
      date,
      pageviews: events.length,
      visitors: uniqueDeviceIds.size,
      sessions: totalSessions,
      bounceRate: Math.round((bouncedSessions / totalSessions) * 100) / 100,
      avgDuration: Math.round(avgDuration * 100) / 100,
      topPages: this.topN(pageCount, 10).map(([url, count]) => ({ url, count })),
      topSources: this.topN(sourceCount, 10).map(([referrer, count]) => ({ referrer, count })),
      countries: this.topN(countryCount, 10).map(([country, count]) => ({ country, count })),
      browsers: this.topN(browserCount, 10).map(([browser, count]) => ({ browser, count })),
      devices: this.topN(deviceCount, 5).map(([screenWidth, count]) => ({ screenWidth, count })),
    };
  }

  private topN(map: Map<string, number>, n: number): [string, number][] {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
}

