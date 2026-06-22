interface PageViewEntry {
  url: string;
  timestamp: number;
}

interface VisitorEntry {
  deviceId: string;
  url: string;
  timestamp: number;
}

interface TimeWindow {
  ms: number;
  label: string;
}

export interface RealtimeStats {
  currentVisitors: number;
  pageviewsPerMinute: number;
  topPages: Array<{ url: string; count: number }>;
  pageviews: number;
  visitors: number;
}

export interface RealtimeSnapshot {
  last5min: RealtimeStats;
  last30min: RealtimeStats;
  last1hour: RealtimeStats;
}

const TIME_WINDOWS: TimeWindow[] = [
  { ms: 5 * 60 * 1000, label: '5min' },
  { ms: 30 * 60 * 1000, label: '30min' },
  { ms: 60 * 60 * 1000, label: '1hour' },
];

const CLEANUP_INTERVAL_MS = 30_000;

export class RealtimeCounter {
  private pageViews: PageViewEntry[] = [];
  private visitors: VisitorEntry[] = [];
  private pageCounts: Map<string, number> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lock = false;

  constructor() {
    this.startCleanup();
  }

  trackPageView(
    url: string,
    deviceId: string,
    _sessionId: string,
    _siteId: string,
  ): void {
    const now = Date.now();

    this.pageViews.push({ url, timestamp: now });
    this.visitors.push({ deviceId, url, timestamp: now });

    this.pageCounts.set(url, (this.pageCounts.get(url) ?? 0) + 1);
  }

  getSnapshot(): RealtimeSnapshot {
    const now = Date.now();
    return {
      last5min: this.getWindowStats(now, TIME_WINDOWS[0].ms),
      last30min: this.getWindowStats(now, TIME_WINDOWS[1].ms),
      last1hour: this.getWindowStats(now, TIME_WINDOWS[2].ms),
    };
  }

  getWindowStats(now: number, windowMs: number): RealtimeStats {
    const cutoff = now - windowMs;

    const recentPageViews = this.pageViews.filter(
      (pv) => pv.timestamp >= cutoff,
    );
    const recentVisitors = this.visitors.filter(
      (v) => v.timestamp >= cutoff,
    );

    const uniqueDeviceIds = new Set(
      recentVisitors.map((v) => v.deviceId),
    );

    const pagesInWindow = new Map<string, number>();
    for (const pv of recentPageViews) {
      pagesInWindow.set(pv.url, (pagesInWindow.get(pv.url) ?? 0) + 1);
    }

    const topPages = Array.from(pagesInWindow.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    const windowMinutes = windowMs / 60_000;
    const pageviewsPerMinute =
      windowMinutes > 0
        ? Math.round((recentPageViews.length / windowMinutes) * 10) / 10
        : 0;

    return {
      currentVisitors: uniqueDeviceIds.size,
      pageviewsPerMinute,
      topPages,
      pageviews: recentPageViews.length,
      visitors: uniqueDeviceIds.size,
    };
  }

  getCurrentVisitors(): number {
    const now = Date.now();
    const cutoff = now - 5 * 60 * 1000;
    const recent = this.visitors.filter((v) => v.timestamp >= cutoff);
    return new Set(recent.map((v) => v.deviceId)).size;
  }

  getTopPagesNow(limit: number = 10): Array<{ url: string; count: number }> {
    const now = Date.now();
    const cutoff = now - 5 * 60 * 1000;
    const recent = this.pageViews.filter((pv) => pv.timestamp >= cutoff);

    const counts = new Map<string, number>();
    for (const pv of recent) {
      counts.set(pv.url, (counts.get(pv.url) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([url, count]) => ({ url, count }));
  }

  getPageviewsPerMinute(): number {
    const now = Date.now();
    const cutoff = now - 60_000;
    return this.pageViews.filter((pv) => pv.timestamp >= cutoff).length;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  private cleanup(): void {
    if (this.lock) return;
    this.lock = true;

    try {
      const maxWindow = TIME_WINDOWS[TIME_WINDOWS.length - 1].ms;
      const cutoff = Date.now() - maxWindow * 2;

      this.pageViews = this.pageViews.filter(
        (pv) => pv.timestamp >= cutoff,
      );
      this.visitors = this.visitors.filter(
        (v) => v.timestamp >= cutoff,
      );

      this.rebuildPageCounts();
    } finally {
      this.lock = false;
    }
  }

  private rebuildPageCounts(): void {
    const now = Date.now();
    const cutoff = now - TIME_WINDOWS[0].ms;

    this.pageCounts.clear();
    for (const pv of this.pageViews) {
      if (pv.timestamp >= cutoff) {
        this.pageCounts.set(
          pv.url,
          (this.pageCounts.get(pv.url) ?? 0) + 1,
        );
      }
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getMemoryStats(): {
    pageViewsCount: number;
    visitorsCount: number;
  } {
    return {
      pageViewsCount: this.pageViews.length,
      visitorsCount: this.visitors.length,
    };
  }
}
