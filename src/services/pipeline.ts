import { PrismaClient, Prisma } from "@prisma/client";

export interface RawEvent {
  siteId: string;
  name: string;
  url: string;
  referrer?: string | null;
  screenWidth?: number;
  screenHeight?: number;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  city?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  props?: Record<string, unknown>;
  timestamp?: Date;
}

interface NormalizedEvent {
  siteId: string;
  name: string;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  url: string;
  country: string | null;
  city: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  deviceId: string | null;
  sessionId: string | null;
  props: string;
  createdAt: Date;
}

const BROWSER_ALIASES: Record<string, string> = {
  'google chrome': 'chrome',
  'chrome': 'chrome',
  'mozilla firefox': 'firefox',
  'firefox': 'firefox',
  'apple safari': 'safari',
  'safari': 'safari',
  'microsoft edge': 'edge',
  'edge': 'edge',
  'opera': 'opera',
  'opr': 'opera',
  'ie': 'ie',
  'internet explorer': 'ie',
  'brave': 'brave',
  'vivaldi': 'vivaldi',
};

const OS_ALIASES: Record<string, string> = {
  'windows nt 10.0': 'windows',
  'windows nt 6.3': 'windows',
  'windows nt 6.2': 'windows',
  'windows nt 6.1': 'windows',
  'windows': 'windows',
  'mac os x': 'macos',
  'macos': 'macos',
  'macintosh': 'macos',
  'linux': 'linux',
  'android': 'android',
  'iphone': 'ios',
  'ipad': 'ios',
  'ios': 'ios',
  'chrome os': 'chromeos',
};

const REFERRER_DOMAINS: Record<string, string> = {
  'www.google.com': 'google',
  'google.com': 'google',
  'www.bing.com': 'bing',
  'bing.com': 'bing',
  'www.yahoo.com': 'yahoo',
  'yahoo.com': 'yahoo',
  'duckduckgo.com': 'duckduckgo',
  'www.duckduckgo.com': 'duckduckgo',
  't.co': 'twitter',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'www.facebook.com': 'facebook',
  'facebook.com': 'facebook',
  'linkedin.com': 'linkedin',
  'www.linkedin.com': 'linkedin',
  'reddit.com': 'reddit',
  'www.reddit.com': 'reddit',
};

function normalizeBrowser(raw?: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return BROWSER_ALIASES[lower] ?? lower;
}

function normalizeOS(raw?: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return OS_ALIASES[lower] ?? lower;
}

function normalizeReferrer(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return REFERRER_DOMAINS[host] ?? host;
  } catch {
    return raw.toLowerCase().trim() || null;
  }
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return url.pathname + url.search + url.hash;
  } catch {
    return raw;
  }
}

function serializeProps(props?: Record<string, unknown>): string {
  if (!props) return '{}';
  try {
    return JSON.stringify(props);
  } catch {
    return '{}';
  }
}

export interface PipelineConfig {
  bufferSize: number;
  flushIntervalMs: number;
  dedupWindowMs: number;
  batchSize: number;
}

const DEFAULT_CONFIG: PipelineConfig = {
  bufferSize: 1000,
  flushIntervalMs: 5_000,
  dedupWindowMs: 30_000,
  batchSize: 100,
};

export class EventQueue {
  private buffer: RawEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dedupMap = new Map<string, number>();
  private isFlushing = false;
  private readonly config: PipelineConfig;

  constructor(
    private prisma: PrismaClient,
    config?: Partial<PipelineConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[EventQueue] Flush error:', err);
      });
    }, this.config.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async enqueue(event: RawEvent): Promise<void> {
    if (this.buffer.length >= this.config.bufferSize) {
      await this.flush();
    }

    const dedupKey = `${event.deviceId ?? 'none'}:${event.url}:${event.sessionId ?? 'none'}`;
    const now = Date.now();
    const lastSeen = this.dedupMap.get(dedupKey);

    if (lastSeen && now - lastSeen < this.config.dedupWindowMs) {
      return;
    }

    this.dedupMap.set(dedupKey, now);
    this.buffer.push(event);
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;

    this.isFlushing = true;
    try {
      const events = this.buffer.splice(0, this.config.bufferSize);
      const normalized = events.map((e) => this.normalizeEvent(e));

      for (let i = 0; i < normalized.length; i += this.config.batchSize) {
        const batch = normalized.slice(i, i + this.config.batchSize);
        await this.batchInsert(batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  cleanupDedupMap(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.dedupMap) {
      if (now - timestamp > this.config.dedupWindowMs * 2) {
        this.dedupMap.delete(key);
      }
    }
  }

  private normalizeEvent(event: RawEvent): NormalizedEvent {
    return {
      siteId: event.siteId,
      name: event.name,
      browser: normalizeBrowser(event.browser),
      os: normalizeOS(event.os),
      referrer: normalizeReferrer(event.referrer),
      url: normalizeUrl(event.url),
      country: event.country ?? null,
      city: event.city ?? null,
      screenWidth: event.screenWidth ?? null,
      screenHeight: event.screenHeight ?? null,
      utmSource: event.utmSource ?? null,
      utmMedium: event.utmMedium ?? null,
      utmCampaign: event.utmCampaign ?? null,
      deviceId: event.deviceId ?? null,
      sessionId: event.sessionId ?? null,
      props: serializeProps(event.props),
      createdAt: event.timestamp ?? new Date(),
    };
  }

  private async batchInsert(events: NormalizedEvent[]): Promise<void> {
    const data: Prisma.EventCreateManyInput[] = events.map((e) => ({
      siteId: e.siteId,
      name: e.name,
      url: e.url,
      referrer: e.referrer,
      screenWidth: e.screenWidth,
      screenHeight: e.screenHeight,
      browser: e.browser,
      os: e.os,
      country: e.country,
      city: e.city,
      utmSource: e.utmSource,
      utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign,
      deviceId: e.deviceId,
      sessionId: e.sessionId,
      props: e.props,
      createdAt: e.createdAt,
    }));

    await this.prisma.event.createMany({ data });
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getPendingCount(): number {
    return this.buffer.length;
  }
}

