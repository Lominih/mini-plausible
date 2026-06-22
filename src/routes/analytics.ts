import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import {
  resolveDateRange,
  buildEventWhereClause,
  buildDailyAggregateWhereClause,
  shouldUseAggregate,
  getGroupByInterval,
  parseFilters,
} from "../services/query-builder";
import {
  computePreviousPeriod,
  buildTimeSeriesComparison,
} from "../services/comparison";
import { authMiddleware } from "../middleware/auth";
import { Period, DateRange, TimeSeriesEntry, BreakdownEntry } from "../types/analytics";
import { queryCache } from "../services/cache";

const router = Router();
router.use(authMiddleware);

interface EndpointQuery {
  siteId: string;
  period?: string;
  date_from?: string;
  date_to?: string;
  filters?: string;
  compare?: string;
  limit?: string;
  group_by?: string;
}

function buildCacheKey(prefix: string, siteId: string, dateRange: DateRange, filters?: Record<string, string>): string {
  return `${prefix}:${siteId}:${dateRange.from.getTime()}:${dateRange.to.getTime()}:${JSON.stringify(filters ?? {})}`;
}

function parseQuery(req: Request): {
  siteId: string;
  dateRange: DateRange;
  filters?: Record<string, string>;
  limit: number;
  compare: boolean;
} {
  const q = req.query as unknown as EndpointQuery;
  if (!q.siteId) {
    throw new Error("siteId query parameter is required");
  }
  const period: Period = (q.period as Period) || "30d";
  const dateRange = resolveDateRange(period, q.date_from, q.date_to);
  const filters = parseFilters(q.filters);
  const limit = parseInt(q.limit || "10", 10);
  const compare = q.compare === "true";
  return { siteId: q.siteId, dateRange, filters, limit, compare };
}

function groupByTimeUnit(
  dates: Date[],
  interval: "hour" | "day"
): Record<string, number> {
  const grouped: Record<string, number> = {};

  for (const date of dates) {
    let key: string;
    if (interval === "hour") {
      key = date.toISOString().slice(0, 13).replace("T", " ");
    } else {
      key = date.toISOString().split("T")[0];
    }
    grouped[key] = (grouped[key] || 0) + 1;
  }

  return grouped;
}

function classifyDevice(screenWidth: number | null): string {
  if (screenWidth === null || screenWidth === undefined) return "desktop";
  if (screenWidth < 768) return "mobile";
  if (screenWidth < 1024) return "tablet";
  return "desktop";
}

// Realtime ！ not cached (real-time data)
router.get("/realtime", async (req: Request, res: Response) => {
  try {
    const q = req.query as unknown as EndpointQuery;
    if (!q.siteId) {
      res.status(400).json({ error: "siteId query parameter is required" });
      return;
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [sessions, pageviewsLast5Min] = await Promise.all([
      prisma.session.findMany({
        where: {
          siteId: q.siteId,
          lastSeen: { gte: fiveMinAgo },
        },
        select: { deviceId: true },
      }),
      prisma.event.count({
        where: {
          siteId: q.siteId,
          createdAt: { gte: fiveMinAgo },
        },
      }),
    ]);

    const uniqueDeviceIds = new Set(sessions.map((s) => s.deviceId));

    res.json({
      onlineVisitors: uniqueDeviceIds.size,
      pageviewsLast5Min,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Visitors over time ！ cached
router.get("/visitors", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, compare } = parseQuery(req);
    const useAggregate = shouldUseAggregate(dateRange);

    const cacheKey = buildCacheKey("visitors", siteId, dateRange, filters);
    const suffix = compare ? ":cmp" : "";

    const result = await queryCache.cached(cacheKey + suffix, undefined, async () => {
      if (useAggregate) {
        const where = buildDailyAggregateWhereClause(siteId, dateRange);
        const aggregates = await prisma.dailyAggregate.findMany({
          where,
          orderBy: { date: "asc" },
          select: { date: true, visitors: true },
        });

        const series: TimeSeriesEntry[] = aggregates.map((a) => ({
          date: a.date.toISOString().split("T")[0],
          value: a.visitors,
        }));

        if (compare) {
          const prevRange = computePreviousPeriod(dateRange);
          const prevWhere = buildDailyAggregateWhereClause(siteId, prevRange);
          const prevAggregates = await prisma.dailyAggregate.findMany({
            where: prevWhere,
            orderBy: { date: "asc" },
            select: { date: true, visitors: true },
          });
          const prevSeries: TimeSeriesEntry[] = prevAggregates.map((a) => ({
            date: a.date.toISOString().split("T")[0],
            value: a.visitors,
          }));
          return buildTimeSeriesComparison(series, prevSeries);
        }

        return series;
      }

      const where = buildEventWhereClause(siteId, dateRange, filters);
      const interval = getGroupByInterval(dateRange);

      const events = await prisma.event.findMany({
        where,
        select: { createdAt: true, deviceId: true },
        orderBy: { createdAt: "asc" },
      });

      const grouped: Record<string, Set<string>> = {};
      for (const event of events) {
        let key: string;
        if (interval === "hour") {
          key = event.createdAt.toISOString().slice(0, 13).replace("T", " ");
        } else {
          key = event.createdAt.toISOString().split("T")[0];
        }
        if (!grouped[key]) grouped[key] = new Set();
        if (event.deviceId) grouped[key].add(event.deviceId);
      }

      const series: TimeSeriesEntry[] = Object.entries(grouped).map(([date, deviceSet]) => ({
        date,
        value: deviceSet.size,
      }));

      return series;
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Pageviews over time ！ cached
router.get("/pageviews", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, compare } = parseQuery(req);
    const useAggregate = shouldUseAggregate(dateRange);

    const cacheKey = buildCacheKey("pageviews", siteId, dateRange, filters);
    const suffix = compare ? ":cmp" : "";

    const result = await queryCache.cached(cacheKey + suffix, undefined, async () => {
      if (useAggregate) {
        const where = buildDailyAggregateWhereClause(siteId, dateRange);
        const aggregates = await prisma.dailyAggregate.findMany({
          where,
          orderBy: { date: "asc" },
          select: { date: true, pageviews: true },
        });

        const series: TimeSeriesEntry[] = aggregates.map((a) => ({
          date: a.date.toISOString().split("T")[0],
          value: a.pageviews,
        }));

        if (compare) {
          const prevRange = computePreviousPeriod(dateRange);
          const prevWhere = buildDailyAggregateWhereClause(siteId, prevRange);
          const prevAggregates = await prisma.dailyAggregate.findMany({
            where: prevWhere,
            orderBy: { date: "asc" },
            select: { date: true, pageviews: true },
          });
          const prevSeries: TimeSeriesEntry[] = prevAggregates.map((a) => ({
            date: a.date.toISOString().split("T")[0],
            value: a.pageviews,
          }));
          return buildTimeSeriesComparison(series, prevSeries);
        }

        return series;
      }

      const where = buildEventWhereClause(siteId, dateRange, filters);
      const interval = getGroupByInterval(dateRange);

      const events = await prisma.event.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const grouped = groupByTimeUnit(events.map((e) => e.createdAt), interval);
      const series: TimeSeriesEntry[] = Object.entries(grouped).map(([date, count]) => ({
        date,
        value: count,
      }));

      return series;
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Sources ！ cached
router.get("/sources", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("sources", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);
      const events = await prisma.event.findMany({
        where,
        select: { referrer: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        const referrer = event.referrer || "(direct)";
        counts.set(referrer, (counts.get(referrer) || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Pages ！ cached
router.get("/pages", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("pages", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);
      const events = await prisma.event.findMany({
        where,
        select: { url: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        counts.set(event.url, (counts.get(event.url) || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Countries ！ cached
router.get("/countries", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("countries", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);
      const events = await prisma.event.findMany({
        where,
        select: { country: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        const country = event.country || "(unknown)";
        counts.set(country, (counts.get(country) || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Browsers ！ cached
router.get("/browsers", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("browsers", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);
      const events = await prisma.event.findMany({
        where,
        select: { browser: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        const browser = event.browser || "(unknown)";
        counts.set(browser, (counts.get(browser) || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// OS ！ cached
router.get("/os", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("os", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);
      const events = await prisma.event.findMany({
        where,
        select: { os: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        const os = event.os || "(unknown)";
        counts.set(os, (counts.get(os) || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Devices ！ cached
router.get("/devices", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("devices", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);
      const events = await prisma.event.findMany({
        where,
        select: { screenWidth: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        const device = classifyDevice(event.screenWidth);
        counts.set(device, (counts.get(device) || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Entry Pages ！ cached
router.get("/entry-pages", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("entry-pages", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const sessions = await prisma.session.findMany({
        where: {
          siteId,
          firstVisit: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
        select: { referrer: true, pagesViewed: true, firstVisit: true },
      });

      const pageCounts = new Map<string, number>();
      let total = 0;

      for (const session of sessions) {
        const pages: string[] = JSON.parse(session.pagesViewed);
        const entryPage = pages[0] || "/";
        pageCounts.set(entryPage, (pageCounts.get(entryPage) || 0) + 1);
        total++;
      }

      const sorted = Array.from(pageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Exit Pages ！ cached
router.get("/exit-pages", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);

    const cacheKey = buildCacheKey("exit-pages", siteId, dateRange, filters) + `:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const sessions = await prisma.session.findMany({
        where: {
          siteId,
          lastSeen: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
        select: { pagesViewed: true },
      });

      const pageCounts = new Map<string, number>();
      let total = 0;

      for (const session of sessions) {
        const pages: string[] = JSON.parse(session.pagesViewed);
        const exitPage = pages[pages.length - 1] || "/";
        pageCounts.set(exitPage, (pageCounts.get(exitPage) || 0) + 1);
        total++;
      }

      const sorted = Array.from(pageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// UTM Parameters ！ cached
router.get("/utm", async (req: Request, res: Response) => {
  try {
    const { siteId, dateRange, filters, limit } = parseQuery(req);
    const groupByField = (req.query.group_by as string) || "utm_source";

    const cacheKey = buildCacheKey("utm", siteId, dateRange, filters) + `:${groupByField}:${limit}`;
    const result = await queryCache.cached<BreakdownEntry[]>(cacheKey, undefined, async () => {
      const where = buildEventWhereClause(siteId, dateRange, filters);

      let field: "utmSource" | "utmMedium" | "utmCampaign";
      switch (groupByField) {
        case "utm_medium":
          field = "utmMedium";
          break;
        case "utm_campaign":
          field = "utmCampaign";
          break;
        default:
          field = "utmSource";
      }

      const events = await prisma.event.findMany({
        where,
        select: { [field]: true },
      });

      const counts = new Map<string, number>();
      let total = 0;

      for (const event of events) {
        const value: string | null = (event as Record<string, string | null>)[field];
        counts.set(value || "(none)", (counts.get(value || "(none)") || 0) + 1);
        total++;
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }));
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
