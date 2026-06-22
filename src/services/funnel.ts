import { prisma } from "../utils/prisma";

export interface FunnelStep {
  type: "event" | "page";
  value: string;
}

export interface FunnelDefinition {
  id: string;
  siteId: string;
  name: string;
  steps: FunnelStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelStepResult {
  stepIndex: number;
  type: "event" | "page";
  value: string;
  users: number;
  conversionRate: number;
  dropOffRate: number;
  dropOffUsers: number;
  averageTimeToStep: number | null;
}

export interface FunnelResult {
  funnel: FunnelDefinition;
  totalVisitors: number;
  totalCompleters: number;
  overallConversionRate: number;
  steps: FunnelStepResult[];
  timeToConvert?: {
    average: number;
    median: number;
    min: number;
    max: number;
  };
}

export interface FunnelQueryOptions {
  funnelId?: string;
  siteId: string;
  steps?: FunnelStep[];
  startDate: Date;
  endDate: Date;
}

async function getUsersForStep(
  siteId: string,
  step: FunnelStep,
  startDate: Date,
  endDate: Date,
  previousUserIds?: Set<string>
): Promise<Map<string, Date>> {
  const userTimestamps = new Map<string, Date>();

  if (step.type === "event") {
    const events = await prisma.event.findMany({
      where: {
        siteId,
        name: step.value,
        deviceId: { not: null },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { deviceId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    for (const event of events) {
      if (event.deviceId) {
        if (previousUserIds && !previousUserIds.has(event.deviceId)) continue;
        if (!userTimestamps.has(event.deviceId)) {
          userTimestamps.set(event.deviceId, event.createdAt);
        }
      }
    }
  } else if (step.type === "page") {
    const pageviews = await prisma.pageview.findMany({
      where: {
        siteId,
        url: { contains: step.value },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    for (const pv of pageviews) {
      const uid = pv.userId || "anonymous";
      if (previousUserIds && !previousUserIds.has(uid)) continue;
      if (!userTimestamps.has(uid)) {
        userTimestamps.set(uid, pv.createdAt);
      }
    }
  }

  return userTimestamps;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function calculateFunnel(options: FunnelQueryOptions): Promise<FunnelResult> {
  const { funnelId, siteId, steps: querySteps, startDate, endDate } = options;

  let funnelSteps: FunnelStep[];
  let funnelDef: FunnelDefinition | null = null;

  if (funnelId) {
    const dbFunnel = await prisma.funnel.findUnique({ where: { id: funnelId } });
    if (!dbFunnel) throw new Error("Funnel not found");
    funnelSteps = JSON.parse(dbFunnel.steps);
    funnelDef = {
      id: dbFunnel.id,
      siteId: dbFunnel.siteId,
      name: dbFunnel.name,
      steps: funnelSteps,
      createdAt: dbFunnel.createdAt,
      updatedAt: dbFunnel.updatedAt,
    };
  } else if (querySteps) {
    funnelSteps = querySteps;
    funnelDef = {
      id: "adhoc",
      siteId,
      name: "Ad-hoc funnel",
      steps: funnelSteps,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } else {
    throw new Error("Either funnelId or steps must be provided");
  }

  // Count unique visitors for the site in the date range
  const eventsForVisitorCount = await prisma.event.findMany({
    where: { siteId, createdAt: { gte: startDate, lte: endDate } },
    select: { deviceId: true },
  });
  const totalVisitors = new Set(eventsForVisitorCount.map((e) => e.deviceId).filter(Boolean)).size;

  const stepResults: FunnelStepResult[] = [];
  let previousUserIds: Set<string> | undefined;
  const userTimestampsPerStep: Map<string, Date>[] = [];

  for (let i = 0; i < funnelSteps.length; i++) {
    const step = funnelSteps[i];
    const timestamps = await getUsersForStep(siteId, step, startDate, endDate, previousUserIds);
    userTimestampsPerStep.push(timestamps);

    const users = timestamps.size;
    const conversionRate = totalVisitors > 0 ? Math.round((users / totalVisitors) * 10000) / 100 : 0;
    const prevUsers = i === 0 ? totalVisitors : stepResults[i - 1].users;
    const dropOffUsers = Math.max(0, prevUsers - users);
    const dropOffRate = prevUsers > 0 ? Math.round((dropOffUsers / prevUsers) * 10000) / 100 : 0;

    let averageTimeToStep: number | null = null;
    if (i > 0 && timestamps.size > 0) {
      let totalDiff = 0;
      let count = 0;
      for (const [userId, currentTimestamp] of timestamps) {
        const prevTimestamp = userTimestampsPerStep[i - 1].get(userId);
        if (prevTimestamp && currentTimestamp > prevTimestamp) {
          totalDiff += currentTimestamp.getTime() - prevTimestamp.getTime();
          count++;
        }
      }
      if (count > 0) {
        averageTimeToStep = Math.round(totalDiff / count / 1000);
      }
    }

    stepResults.push({
      stepIndex: i,
      type: step.type,
      value: step.value,
      users,
      conversionRate,
      dropOffRate,
      dropOffUsers,
      averageTimeToStep,
    });

    previousUserIds = new Set(timestamps.keys());
  }

  const totalCompleters = stepResults.length > 0 ? stepResults[stepResults.length - 1].users : 0;
  const overallConversionRate =
    totalVisitors > 0 ? Math.round((totalCompleters / totalVisitors) * 10000) / 100 : 0;

  let timeToConvert: FunnelResult["timeToConvert"];
  if (userTimestampsPerStep.length >= 2) {
    const firstStep = userTimestampsPerStep[0];
    const lastStep = userTimestampsPerStep[userTimestampsPerStep.length - 1];
    const durations: number[] = [];

    for (const [userId, endTimestamp] of lastStep) {
      const startTimestamp = firstStep.get(userId);
      if (startTimestamp && endTimestamp > startTimestamp) {
        durations.push(endTimestamp.getTime() - startTimestamp.getTime());
      }
    }

    if (durations.length > 0) {
      const sortedDurations = [...durations].sort((a, b) => a - b);
      timeToConvert = {
        average: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000),
        median: Math.round(calculateMedian(sortedDurations) / 1000),
        min: Math.round(sortedDurations[0] / 1000),
        max: Math.round(sortedDurations[sortedDurations.length - 1] / 1000),
      };
    }
  }

  return {
    funnel: funnelDef!,
    totalVisitors,
    totalCompleters,
    overallConversionRate,
    steps: stepResults,
    timeToConvert,
  };
}

export async function saveFunnel(
  siteId: string,
  userId: string,
  name: string,
  steps: FunnelStep[]
): Promise<FunnelDefinition> {
  const dbFunnel = await prisma.funnel.create({
    data: {
      siteId,
      userId,
      name,
      steps: JSON.stringify(steps),
    },
  });

  return {
    id: dbFunnel.id,
    siteId: dbFunnel.siteId,
    name: dbFunnel.name,
    steps: JSON.parse(dbFunnel.steps),
    createdAt: dbFunnel.createdAt,
    updatedAt: dbFunnel.updatedAt,
  };
}