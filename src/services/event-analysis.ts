import { prisma } from "../utils/prisma";
import { format, eachDayOfInterval } from "date-fns";

export interface EventTrendOptions {
  siteId: string;
  eventName?: string;
  startDate: Date;
  endDate: Date;
  interval?: "day" | "week" | "month";
}

export interface EventPropertyBreakdownOptions {
  siteId: string;
  eventName: string;
  propertyName: string;
  startDate: Date;
  endDate: Date;
  limit?: number;
}

export interface TopEventsOptions {
  siteId: string;
  startDate: Date;
  endDate: Date;
  limit?: number;
}

export interface EventComparisonOptions {
  siteId: string;
  eventA: string;
  eventB: string;
  startDate: Date;
  endDate: Date;
  compareBy?: "count" | "properties";
  propertyName?: string;
}

interface EventTrendPoint {
  date: string;
  count: number;
  uniqueVisitors: number;
}

interface PropertyBreakdownItem {
  value: string;
  count: number;
  percentage: number;
}

interface TopEventItem {
  name: string;
  count: number;
  uniqueVisitors: number;
  percentage: number;
}

interface EventComparisonResult {
  eventA: {
    name: string;
    total: number;
    uniqueVisitors: number;
    dailyAverage: number;
    propertyBreakdown?: Record<string, PropertyBreakdownItem[]>;
  };
  eventB: {
    name: string;
    total: number;
    uniqueVisitors: number;
    dailyAverage: number;
    propertyBreakdown?: Record<string, PropertyBreakdownItem[]>;
  };
  comparison: {
    countDifference: number;
    countPercentageDiff: number;
    visitorDifference: number;
  };
}

export async function getEventTrends(options: EventTrendOptions): Promise<EventTrendPoint[]> {
  const { siteId, eventName, startDate, endDate, interval = "day" } = options;

  const events = await prisma.event.findMany({
    where: {
      siteId,
      ...(eventName ? { name: eventName } : {}),
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      createdAt: true,
      deviceId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const grouped: Record<string, { count: number; visitors: Set<string> }> = {};

  for (const event of events) {
    let key: string;
    if (interval === "day") {
      key = format(event.createdAt, "yyyy-MM-dd");
    } else if (interval === "week") {
      const dayOfWeek = event.createdAt.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(event.createdAt);
      monday.setDate(monday.getDate() + mondayOffset);
      key = format(monday, "yyyy-MM-dd");
    } else {
      key = format(event.createdAt, "yyyy-MM-01");
    }

    if (!grouped[key]) {
      grouped[key] = { count: 0, visitors: new Set() };
    }
    grouped[key].count++;
    if (event.deviceId) {
      grouped[key].visitors.add(event.deviceId);
    }
  }

  const result: EventTrendPoint[] = [];
  const allDates = eachDayOfInterval({ start: startDate, end: endDate });

  for (const date of allDates) {
    let key: string;
    if (interval === "day") {
      key = format(date, "yyyy-MM-dd");
    } else if (interval === "week") {
      const dayOfWeek = date.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(monday.getDate() + mondayOffset);
      key = format(monday, "yyyy-MM-dd");
    } else {
      key = format(date, "yyyy-MM-01");
    }

    const existing = grouped[key];
    result.push({
      date: key,
      count: existing?.count || 0,
      uniqueVisitors: existing?.visitors.size || 0,
    });
  }

  return result;
}

export async function getPropertyBreakdown(
  options: EventPropertyBreakdownOptions
): Promise<PropertyBreakdownItem[]> {
  const { siteId, eventName, propertyName, startDate, endDate, limit = 20 } = options;

  const events = await prisma.event.findMany({
    where: {
      siteId,
      name: eventName,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { props: true },
  });

  const counts: Record<string, number> = {};
  let total = 0;

  for (const event of events) {
    try {
      const props = JSON.parse(event.props);
      const value = props[propertyName];
      if (value !== undefined && value !== null) {
        const strValue = String(value);
        counts[strValue] = (counts[strValue] || 0) + 1;
        total++;
      }
    } catch {
      // skip events with invalid props
    }
  }

  return Object.entries(counts)
    .map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getTopEvents(options: TopEventsOptions): Promise<TopEventItem[]> {
  const { siteId, startDate, endDate, limit = 10 } = options;

  const events = await prisma.event.findMany({
    where: {
      siteId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { name: true, deviceId: true },
  });

  const eventCounts: Record<string, { count: number; visitors: Set<string> }> = {};
  let totalCount = 0;

  for (const event of events) {
    if (!eventCounts[event.name]) {
      eventCounts[event.name] = { count: 0, visitors: new Set() };
    }
    eventCounts[event.name].count++;
    if (event.deviceId) {
      eventCounts[event.name].visitors.add(event.deviceId);
    }
    totalCount++;
  }

  return Object.entries(eventCounts)
    .map(([name, data]) => ({
      name,
      count: data.count,
      uniqueVisitors: data.visitors.size,
      percentage: totalCount > 0 ? Math.round((data.count / totalCount) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function compareEvents(options: EventComparisonOptions): Promise<EventComparisonResult> {
  const { siteId, eventA, eventB, startDate, endDate, compareBy = "count" } = options;
  const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const [eventsARaw, eventsBRaw] = await Promise.all([
    prisma.event.findMany({
      where: { siteId, name: eventA, createdAt: { gte: startDate, lte: endDate } },
      select: { deviceId: true, props: true },
    }),
    prisma.event.findMany({
      where: { siteId, name: eventB, createdAt: { gte: startDate, lte: endDate } },
      select: { deviceId: true, props: true },
    }),
  ]);

  const visitorsA = new Set(eventsARaw.map((e) => e.deviceId).filter(Boolean));
  const visitorsB = new Set(eventsBRaw.map((e) => e.deviceId).filter(Boolean));

  const result: EventComparisonResult = {
    eventA: {
      name: eventA,
      total: eventsARaw.length,
      uniqueVisitors: visitorsA.size,
      dailyAverage: Math.round((eventsARaw.length / dayCount) * 100) / 100,
    },
    eventB: {
      name: eventB,
      total: eventsBRaw.length,
      uniqueVisitors: visitorsB.size,
      dailyAverage: Math.round((eventsBRaw.length / dayCount) * 100) / 100,
    },
    comparison: {
      countDifference: eventsARaw.length - eventsBRaw.length,
      countPercentageDiff:
        eventsBRaw.length > 0
          ? Math.round(((eventsARaw.length - eventsBRaw.length) / eventsBRaw.length) * 10000) / 100
          : eventsARaw.length > 0 ? 100 : 0,
      visitorDifference: visitorsA.size - visitorsB.size,
    },
  };

  if (compareBy === "properties") {
    const extractBreakdown = (events: { props: string }[]): Record<string, PropertyBreakdownItem[]> => {
      const propsMap: Record<string, Record<string, number>> = {};
      for (const event of events) {
        try {
          const props = JSON.parse(event.props);
          for (const [key, value] of Object.entries(props)) {
            if (!propsMap[key]) propsMap[key] = {};
            const strVal = String(value);
            propsMap[key][strVal] = (propsMap[key][strVal] || 0) + 1;
          }
        } catch {
          // skip
        }
      }

      const breakdown: Record<string, PropertyBreakdownItem[]> = {};
      for (const [key, counts] of Object.entries(propsMap)) {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        breakdown[key] = Object.entries(counts)
          .map(([value, count]) => ({
            value,
            count,
            percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
          }))
          .sort((a, b) => b.count - a.count);
      }
      return breakdown;
    };

    result.eventA.propertyBreakdown = extractBreakdown(eventsARaw);
    result.eventB.propertyBreakdown = extractBreakdown(eventsBRaw);
  }

  return result;
}