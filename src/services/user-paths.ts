import { prisma } from "../utils/prisma";

export interface PathQueryOptions {
  siteId: string;
  startDate: Date;
  endDate: Date;
  maxDepth?: number;
  limit?: number;
}

export interface PathNode {
  name: string;
  type: "page" | "event";
  count: number;
  percentage: number;
  children: PathNode[];
}

export interface PathSequence {
  path: Array<{ name: string; type: "page" | "event" }>;
  count: number;
  uniqueVisitors: number;
}

export interface UserPathsResult {
  entryPoints: Array<{ name: string; type: "page" | "event"; count: number; percentage: number }>;
  exitPoints: Array<{ name: string; type: "page" | "event"; count: number; percentage: number }>;
  pathTree: PathNode;
  topPaths: PathSequence[];
  totalSessions: number;
  avgSessionLength: number;
}

interface SessionEvent {
  sessionId: string;
  type: "page" | "event";
  name: string;
  createdAt: Date;
  deviceId: string | null;
}

export async function analyzeUserPaths(options: PathQueryOptions): Promise<UserPathsResult> {
  const { siteId, startDate, endDate, maxDepth = 5, limit = 50 } = options;

  const [events, pageviews] = await Promise.all([
    prisma.event.findMany({
      where: {
        siteId,
        createdAt: { gte: startDate, lte: endDate },
        sessionId: { not: null },
      },
      select: {
        sessionId: true,
        name: true,
        createdAt: true,
        deviceId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pageview.findMany({
      where: {
        siteId,
        createdAt: { gte: startDate, lte: endDate },
        sessionId: { not: null },
      },
      select: {
        sessionId: true,
        url: true,
        createdAt: true,
        userId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const allSessionEvents: SessionEvent[] = [
    ...events.map((e) => ({
      sessionId: e.sessionId!,
      type: "event" as const,
      name: e.name,
      createdAt: e.createdAt,
      deviceId: e.deviceId,
    })),
    ...pageviews.map((pv) => ({
      sessionId: pv.sessionId!,
      type: "page" as const,
      name: pv.url,
      createdAt: pv.createdAt,
      deviceId: pv.userId,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const sessionMap = new Map<string, SessionEvent[]>();
  for (const item of allSessionEvents) {
    if (!sessionMap.has(item.sessionId)) {
      sessionMap.set(item.sessionId, []);
    }
    sessionMap.get(item.sessionId)!.push(item);
  }

  const totalSessions = sessionMap.size;
  if (totalSessions === 0) {
    return {
      entryPoints: [],
      exitPoints: [],
      pathTree: { name: "root", type: "page", count: 0, percentage: 0, children: [] },
      topPaths: [],
      totalSessions: 0,
      avgSessionLength: 0,
    };
  }

  const entryCounts: Record<string, { count: number; type: "page" | "event" }> = {};
  const exitCounts: Record<string, { count: number; type: "page" | "event" }> = {};
  let totalSessionDuration = 0;

  for (const [, sessionEvents] of sessionMap) {
    if (sessionEvents.length > 0) {
      const first = sessionEvents[0];
      const last = sessionEvents[sessionEvents.length - 1];

      const entryKey = `${first.type}:${first.name}`;
      entryCounts[entryKey] = entryCounts[entryKey] || { count: 0, type: first.type };
      entryCounts[entryKey].count++;

      const exitKey = `${last.type}:${last.name}`;
      exitCounts[exitKey] = exitCounts[exitKey] || { count: 0, type: last.type };
      exitCounts[exitKey].count++;

      totalSessionDuration += last.createdAt.getTime() - first.createdAt.getTime();
    }
  }

  const entryPoints = Object.entries(entryCounts)
    .map(([key, data]) => {
      const name = key.substring(key.indexOf(":") + 1);
      return { name, type: data.type, count: data.count, percentage: Math.round((data.count / totalSessions) * 10000) / 100 };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const exitPoints = Object.entries(exitCounts)
    .map(([key, data]) => {
      const name = key.substring(key.indexOf(":") + 1);
      return { name, type: data.type, count: data.count, percentage: Math.round((data.count / totalSessions) * 10000) / 100 };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  // Build path tree
  const tree: PathNode = { name: "root", type: "page", count: 0, percentage: 100, children: [] };

  function addPathToTree(steps: SessionEvent[]) {
    let current = tree;
    for (let i = 0; i < Math.min(steps.length, maxDepth + 1); i++) {
      const step = steps[i];
      const nodeName = `${step.type}:${step.name}`;
      let child = current.children.find((c) => `${c.type}:${c.name}` === nodeName);
      if (!child) {
        child = { name: step.name, type: step.type, count: 0, percentage: 0, children: [] };
        current.children.push(child);
      }
      child.count++;
      current = child;
    }
  }

  for (const [, sessionEvents] of sessionMap) {
    addPathToTree(sessionEvents);
  }

  function calculatePercentages(node: PathNode) {
    for (const child of node.children) {
      child.percentage = node.count > 0 ? Math.round((child.count / node.count) * 10000) / 100 : 0;
      calculatePercentages(child);
    }
  }
  calculatePercentages(tree);

  // Top paths
  const pathCounts = new Map<string, { count: number; visitors: Set<string> }>();
  for (const [, sessionEvents] of sessionMap) {
    const pathSteps = sessionEvents.slice(0, maxDepth + 1);
    const pathKey = pathSteps.map((e) => `${e.type}:${e.name}`).join(" -> ");
    if (!pathCounts.has(pathKey)) {
      pathCounts.set(pathKey, { count: 0, visitors: new Set() });
    }
    const entry = pathCounts.get(pathKey)!;
    entry.count++;
    const lastEvent = pathSteps[pathSteps.length - 1];
    if (lastEvent.deviceId) {
      entry.visitors.add(lastEvent.deviceId);
    }
  }

  const topPaths: PathSequence[] = Array.from(pathCounts.entries())
    .map(([pathKey, data]) => ({
      path: pathKey.split(" -> ").map((segment) => {
        const idx = segment.indexOf(":");
        const type = segment.substring(0, idx) as "page" | "event";
        const name = segment.substring(idx + 1);
        return { type, name };
      }),
      count: data.count,
      uniqueVisitors: data.visitors.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return {
    entryPoints,
    exitPoints,
    pathTree: tree,
    topPaths,
    totalSessions,
    avgSessionLength: totalSessions > 0 ? Math.round(totalSessionDuration / totalSessions / 1000) : 0,
  };
}