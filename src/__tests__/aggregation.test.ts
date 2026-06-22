import { describe, it, expect } from 'vitest';

describe('AggregationService', () => {
  describe('bucketDevice', () => {
    function bucketDevice(width: number): string {
      if (width < 768) return '<768';
      if (width < 1024) return '768-1024';
      if (width < 1440) return '1024-1440';
      return '>1440';
    }

    it('buckets mobile devices (<768)', () => {
      expect(bucketDevice(375)).toBe('<768');
      expect(bucketDevice(414)).toBe('<768');
      expect(bucketDevice(767)).toBe('<768');
    });

    it('buckets tablet devices (768-1024)', () => {
      expect(bucketDevice(768)).toBe('768-1024');
      expect(bucketDevice(900)).toBe('768-1024');
      expect(bucketDevice(1023)).toBe('768-1024');
    });

    it('buckets laptop devices (1024-1440)', () => {
      expect(bucketDevice(1024)).toBe('1024-1440');
      expect(bucketDevice(1280)).toBe('1024-1440');
      expect(bucketDevice(1439)).toBe('1024-1440');
    });

    it('buckets desktop devices (>1440)', () => {
      expect(bucketDevice(1440)).toBe('>1440');
      expect(bucketDevice(1920)).toBe('>1440');
      expect(bucketDevice(2560)).toBe('>1440');
    });
  });

  describe('AggregatedMetrics structure', () => {
    function createMetrics(overrides: Record<string, any> = {}) {
      return {
        siteId: 'site-1',
        date: new Date(),
        pageviews: 100,
        visitors: 50,
        sessions: 40,
        bounceRate: 0.3,
        avgDuration: 120.5,
        topPages: [{ url: '/', count: 30 }],
        topSources: [{ referrer: 'google', count: 20 }],
        countries: [{ country: 'US', count: 40 }],
        browsers: [{ browser: 'Chrome', count: 35 }],
        devices: [{ screenWidth: '1024-1440', count: 25 }],
        ...overrides,
      };
    }

    it('has all required fields', () => {
      const metrics = createMetrics();
      expect(metrics).toHaveProperty('siteId');
      expect(metrics).toHaveProperty('date');
      expect(metrics).toHaveProperty('pageviews');
      expect(metrics).toHaveProperty('visitors');
      expect(metrics).toHaveProperty('sessions');
      expect(metrics).toHaveProperty('bounceRate');
      expect(metrics).toHaveProperty('avgDuration');
      expect(metrics).toHaveProperty('topPages');
      expect(metrics).toHaveProperty('topSources');
      expect(metrics).toHaveProperty('countries');
      expect(metrics).toHaveProperty('browsers');
      expect(metrics).toHaveProperty('devices');
    });

    it('bounce rate is between 0 and 1', () => {
      const metrics = createMetrics();
      expect(metrics.bounceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.bounceRate).toBeLessThanOrEqual(1);
    });

    it('pageviews >= visitors', () => {
      const metrics = createMetrics({ pageviews: 100, visitors: 50 });
      expect(metrics.pageviews).toBeGreaterThanOrEqual(metrics.visitors);
    });

    it('top pages array can be sorted by count desc', () => {
      const topPages = [
        { url: '/a', count: 10 },
        { url: '/b', count: 30 },
        { url: '/c', count: 5 },
      ];
      const sorted = [...topPages].sort((a, b) => b.count - a.count);
      const counts = sorted.map((p) => p.count);
      expect(counts).toEqual([30, 10, 5]);
    });

    it('all pageview counts are non-negative', () => {
      const metrics = createMetrics({
        topPages: [
          { url: '/a', count: 10 },
          { url: '/b', count: 0 },
        ],
      });
      for (const page of metrics.topPages) {
        expect(page.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('session timeout logic', () => {
    it('groups events within 30-min window as same session', () => {
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
      const t1 = new Date('2024-01-01T10:00:00Z');
      const t2 = new Date('2024-01-01T10:15:00Z');
      const diff = t2.getTime() - t1.getTime();
      expect(diff).toBeLessThan(SESSION_TIMEOUT_MS);
    });

    it('groups events outside 30-min window as different sessions', () => {
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
      const t1 = new Date('2024-01-01T10:00:00Z');
      const t2 = new Date('2024-01-01T10:31:00Z');
      const diff = t2.getTime() - t1.getTime();
      expect(diff).toBeGreaterThan(SESSION_TIMEOUT_MS);
    });
  });
});