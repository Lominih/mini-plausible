import { describe, it, expect } from 'vitest';
import {
  resolveDateRange,
  buildEventWhereClause,
  buildDailyAggregateWhereClause,
  shouldUseAggregate,
  getGroupByInterval,
  parseFilters,
} from '../services/query-builder';

describe('resolveDateRange', () => {
  it('returns realtime range (last 5 minutes)', () => {
    const range = resolveDateRange('realtime');
    const now = Date.now();
    expect(range.to.getTime()).toBeLessThanOrEqual(now);
    expect(range.from.getTime()).toBeGreaterThanOrEqual(now - 5 * 60 * 1000 - 100);
  });

  it('returns 7d range', () => {
    const range = resolveDateRange('7d');
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(range.to.getTime()).toBeLessThanOrEqual(now);
    expect(range.from.getTime()).toBeGreaterThanOrEqual(now - sevenDaysMs - 100);
  });

  it('returns 30d range by default', () => {
    const range = resolveDateRange('30d');
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(range.from.getTime()).toBeGreaterThanOrEqual(now - thirtyDaysMs - 100);
  });

  it('returns 90d range', () => {
    const range = resolveDateRange('90d');
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(range.from.getTime()).toBeGreaterThanOrEqual(now - ninetyDaysMs - 100);
  });

  it('returns custom date range', () => {
    const range = resolveDateRange('custom', '2024-01-01', '2024-01-31');
    expect(range.from.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(range.to.toISOString().slice(0, 10)).toBe('2024-01-31');
  });

  it('throws for custom without dates', () => {
    expect(() => resolveDateRange('custom')).toThrow('Custom period requires');
  });
});

describe('buildEventWhereClause', () => {
  const now = new Date();

  it('builds basic clause with siteId and date range', () => {
    const where = buildEventWhereClause('site-1', {
      from: new Date('2024-01-01'),
      to: new Date('2024-01-31'),
    });
    expect(where.siteId).toBe('site-1');
    expect(where.createdAt).toEqual({
      gte: new Date('2024-01-01'),
      lte: new Date('2024-01-31'),
    });
  });

  it('applies page filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { page: '/about' },
    );
    expect((where as any).url).toEqual({ contains: '/about' });
  });

  it('applies source filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { source: 'google' },
    );
    expect((where as any).referrer).toEqual({ contains: 'google' });
  });

  it('applies country filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { country: 'US' },
    );
    expect((where as any).country).toBe('US');
  });

  it('applies browser filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { browser: 'Chrome' },
    );
    expect((where as any).browser).toBe('Chrome');
  });

  it('applies os filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { os: 'Windows' },
    );
    expect((where as any).os).toBe('Windows');
  });

  it('applies utm_source filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { utm_source: 'newsletter' },
    );
    expect((where as any).utmSource).toBe('newsletter');
  });

  it('applies utm_medium filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { utm_medium: 'email' },
    );
    expect((where as any).utmMedium).toBe('email');
  });

  it('applies utm_campaign filter', () => {
    const where = buildEventWhereClause(
      'site-1',
      { from: new Date(), to: now },
      { utm_campaign: 'launch' },
    );
    expect((where as any).utmCampaign).toBe('launch');
  });
});

describe('shouldUseAggregate', () => {
  it('returns false for single-day range', () => {
    const result = shouldUseAggregate({
      from: new Date('2024-01-01'),
      to: new Date('2024-01-01'),
    });
    expect(result).toBe(false);
  });

  it('returns true for multi-day range', () => {
    const result = shouldUseAggregate({
      from: new Date('2024-01-01'),
      to: new Date('2024-01-03'),
    });
    expect(result).toBe(true);
  });
});

describe('getGroupByInterval', () => {
  it('returns hour for 2-day range', () => {
    const result = getGroupByInterval({
      from: new Date('2024-01-01'),
      to: new Date('2024-01-02'),
    });
    expect(result).toBe('hour');
  });

  it('returns day for 7-day range', () => {
    const result = getGroupByInterval({
      from: new Date('2024-01-01'),
      to: new Date('2024-01-08'),
    });
    expect(result).toBe('day');
  });
});

describe('parseFilters', () => {
  it('returns undefined for no input', () => {
    expect(parseFilters()).toBeUndefined();
    expect(parseFilters(undefined)).toBeUndefined();
  });

  it('parses valid JSON', () => {
    const result = parseFilters('{"browser":"Chrome"}');
    expect(result).toEqual({ browser: 'Chrome' });
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseFilters('not-json')).toBeUndefined();
  });

  it('returns undefined for non-object JSON', () => {
    expect(parseFilters('"string"')).toBeUndefined();
  });
});