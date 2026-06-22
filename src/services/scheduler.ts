import { AggregationService } from './aggregation';
import { CleanupService } from './cleanup';

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  enabled: boolean;
}

export interface SchedulerConfig {
  hourlyAggregationIntervalMs?: number;
  dailyAggregationIntervalMs?: number;
  cleanupIntervalMs?: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  hourlyAggregationIntervalMs: 60 * 60 * 1000,
  dailyAggregationIntervalMs: 24 * 60 * 60 * 1000,
  cleanupIntervalMs: 12 * 60 * 60 * 1000,
};

export class Scheduler {
  private tasks = new Map<string, ScheduledTask>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private isRunning = false;

  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.name, task);
  }

  startAll(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const [name, task] of this.tasks) {
      if (task.enabled) {
        this.startTask(name);
      }
    }
  }

  stopAll(): void {
    this.isRunning = false;

    for (const [name] of this.timers) {
      this.stopTask(name);
    }
    this.timers.clear();
  }

  startTask(name: string): void {
    const task = this.tasks.get(name);
    if (!task || this.timers.has(name)) return;

    const timer = setInterval(async () => {
      try {
        await task.handler();
      } catch (error) {
        console.error(`[Scheduler] Task "${name}" failed:`, error);
      }
    }, task.intervalMs);

    this.timers.set(name, timer);
  }

  stopTask(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
    }
  }

  enableTask(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.enabled = true;
      if (this.isRunning) this.startTask(name);
    }
  }

  disableTask(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.enabled = false;
      this.stopTask(name);
    }
  }

  async runTaskNow(name: string): Promise<void> {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task "${name}" not found`);
    }
    await task.handler();
  }

  getTaskStatus(): Array<{
    name: string;
    enabled: boolean;
    intervalMs: number;
    isRunning: boolean;
  }> {
    return Array.from(this.tasks.values()).map((task) => ({
      name: task.name,
      enabled: task.enabled,
      intervalMs: task.intervalMs,
      isRunning: this.timers.has(task.name),
    }));
  }

  getRegisteredTasks(): string[] {
    return Array.from(this.tasks.keys());
  }
}

export function createDefaultScheduler(
  aggregationService: AggregationService,
  cleanupService: CleanupService,
  config: SchedulerConfig = {},
  siteIds: string[] = [],
): Scheduler {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const scheduler = new Scheduler();

  scheduler.registerTask({
    name: 'hourly-aggregation',
    intervalMs: mergedConfig.hourlyAggregationIntervalMs!,
    enabled: true,
    handler: async () => {
      const now = new Date();
      const hour = now.getHours();
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      for (const siteId of siteIds) {
        await aggregationService.aggregateAndStoreDaily(siteId, date);
      }
    },
  });

  scheduler.registerTask({
    name: 'daily-aggregation',
    intervalMs: mergedConfig.dailyAggregationIntervalMs!,
    enabled: true,
    handler: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
      );

      await aggregationService.aggregateAllSites(date);
    },
  });

  scheduler.registerTask({
    name: 'data-cleanup',
    intervalMs: mergedConfig.cleanupIntervalMs!,
    enabled: true,
    handler: async () => {
      await cleanupService.runFullCleanup();
    },
  });

  return scheduler;
}
