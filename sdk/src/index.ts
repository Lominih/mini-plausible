/**
 * Mini Plausible SDK — lightweight, privacy-first analytics tracker.
 * Targets <5 KB minified + gzipped.
 */

interface PlausibleOptions {
  domain?: string;
  endpoint?: string;
  hashMode?: boolean;
  batchSize?: number;
  batchInterval?: number;
}

interface EventProps {
  props?: Record<string, unknown>;
}

interface QueuedEvent {
  n: string;
  u: string;
  d: string;
  r: string;
  sw: number;
  sh: number;
  tp: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  props?: Record<string, unknown>;
  timestamp: number;
}

type PlausibleFn = (name: string, props?: EventProps) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn;
    mp?: PlausibleFn;
  }
}

const DEVICE_ID_KEY = 'mp_did';
const LS_AVAILABLE = typeof localStorage !== 'undefined';

function getOrCreateDeviceId(): string {
  if (!LS_AVAILABLE) return crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2);
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function extractUTMParams(url: string): Partial<QueuedEvent> {
  try {
    const u = new URL(url);
    const result: Partial<QueuedEvent> = {};
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
    for (const key of keys) {
      const val = u.searchParams.get(key);
      if (val) (result as any)[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

function getDeviceType(): string {
  const w = typeof screen !== 'undefined' ? screen.width : 0;
  if (w > 0 && w <= 600) return 'mobile';
  if (w > 600 && w <= 1024) return 'tablet';
  return 'desktop';
}

function detectReferrer(): string {
  return document.referrer || '';
}

function getPageUrl(hashMode: boolean): string {
  return hashMode ? location.hash : location.href;
}

const DEFAULTS: PlausibleOptions = {
  domain: '',
  endpoint: '/api/event',
  hashMode: false,
  batchSize: 5,
  batchInterval: 1000,
};

class PlausibleTracker {
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private options: Required<PlausibleOptions>;

  constructor(opts: PlausibleOptions) {
    this.options = { ...DEFAULTS, ...opts } as Required<PlausibleOptions>;
    this.track('pageview');
  }

  track(name: string, eventProps?: EventProps): void {
    const url = getPageUrl(this.options.hashMode);
    const utm = extractUTMParams(url);
    const event: QueuedEvent = {
      n: name,
      u: url,
      d: getOrCreateDeviceId(),
      r: detectReferrer(),
      sw: screen.width,
      sh: screen.height,
      tp: getDeviceType(),
      ...utm,
      ...(eventProps?.props ? { props: eventProps.props } : {}),
      timestamp: Date.now(),
    };
    this.enqueue(event);
  }

  private enqueue(event: QueuedEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.options.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.options.batchInterval);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.options.batchSize);

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' });
      navigator.sendBeacon(this.options.endpoint, blob);
    } else if (typeof XMLHttpRequest !== 'undefined') {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.options.endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(batch));
    }

    if (this.queue.length > 0) {
      this.timer = setTimeout(() => this.flush(), this.options.batchInterval);
    }
  }
}

function init(opts?: PlausibleOptions): void {
  if (window.plausible) return;
  const tracker = new PlausibleTracker(opts ?? {});
  window.plausible = (name: string, props?: EventProps) => tracker.track(name, props);
  window.mp = window.plausible;
}

export { init, PlausibleTracker };
export type { PlausibleOptions, EventProps };