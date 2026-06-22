import { Prisma } from "@prisma/client";
import { Period, DateRange, AnalyticsQueryParams } from "../types/analytics";

const REALTIME_WINDOW_MS = 5 * 60 * 1000;

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

export function resolveDateRange(period: Period, dateFrom?: string, dateTo?: string): DateRange {
  const now = new Date();

  switch (period) {
    case "realtime":
      return {
        from: new Date(now.getTime() - REALTIME_WINDOW_MS),
        to: now,
      };
    case "7d":
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
      };
    case "30d":
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
      };
    case "90d":
      return {
        from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        to: now,
      };
    case "custom": {
      if (!dateFrom || !dateTo) {
        throw new Error("Custom period requires date_from and date_to");
      }
      return {
        from: parseDate(dateFrom),
        to: parseDate(dateTo),
      };
    }
    default:
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
      };
  }
}

export function buildEventWhereClause(
  siteId: string,
  dateRange: DateRange,
  filters?: Record<string, string>
): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {
    siteId,
    createdAt: {
      gte: dateRange.from,
      lte: dateRange.to,
    },
  };

  if (filters) {
    if (filters.page) {
      where.url = { contains: filters.page };
    }
    if (filters.source) {
      where.referrer = { contains: filters.source };
    }
    if (filters.country) {
      where.country = filters.country;
    }
    if (filters.browser) {
      where.browser = filters.browser;
    }
    if (filters.os) {
      where.os = filters.os;
    }
    if (filters.device) {
      where.screenWidth = { not: null };
    }
    if (filters.entry_page) {
      where.url = { contains: filters.entry_page };
    }
    if (filters.utm_source) {
      where.utmSource = filters.utm_source;
    }
    if (filters.utm_medium) {
      where.utmMedium = filters.utm_medium;
    }
    if (filters.utm_campaign) {
      where.utmCampaign = filters.utm_campaign;
    }
  }

  return where;
}

export function buildDailyAggregateWhereClause(
  siteId: string,
  dateRange: DateRange
): Prisma.DailyAggregateWhereInput {
  const fromDay = new Date(dateRange.from);
  fromDay.setHours(0, 0, 0, 0);

  const toDay = new Date(dateRange.to);
  toDay.setHours(23, 59, 59, 999);

  return {
    siteId,
    date: {
      gte: fromDay,
      lte: toDay,
    },
  };
}

export function shouldUseAggregate(dateRange: DateRange): boolean {
  const diffMs = dateRange.to.getTime() - dateRange.from.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays > 1;
}

export function getGroupByInterval(dateRange: DateRange): "hour" | "day" {
  const diffMs = dateRange.to.getTime() - dateRange.from.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays <= 2) {
    return "hour";
  }
  return "day";
}

export function parseFilters(filtersRaw?: string): Record<string, string> | undefined {
  if (!filtersRaw) return undefined;
  try {
    const parsed = JSON.parse(filtersRaw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore invalid JSON
  }
  return undefined;
}
