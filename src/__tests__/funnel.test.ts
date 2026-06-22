import { describe, it, expect } from 'vitest';
import { FunnelStep } from '../services/funnel';

describe('FunnelStep', () => {
  it('defines event-type step', () => {
    const step: FunnelStep = { type: 'event', value: 'Signup' };
    expect(step.type).toBe('event');
    expect(step.value).toBe('Signup');
  });

  it('defines page-type step', () => {
    const step: FunnelStep = { type: 'page', value: '/pricing' };
    expect(step.type).toBe('page');
    expect(step.value).toBe('/pricing');
  });
});

describe('Funnel data structures', () => {
  function buildFunnelResult(steps: Array<{ users: number }>) {
    const totalVisitors = 1000;
    let previousUsers = totalVisitors;
    let totalCompleters = 0;

    return steps.map((step, i) => {
      const conversionRate =
        totalVisitors > 0 ? Math.round((step.users / totalVisitors) * 10000) / 100 : 0;
      const dropOffUsers = Math.max(0, previousUsers - step.users);
      const dropOffRate =
        previousUsers > 0 ? Math.round((dropOffUsers / previousUsers) * 10000) / 100 : 0;
      previousUsers = step.users;
      totalCompleters = step.users;

      return {
        stepIndex: i,
        users: step.users,
        conversionRate,
        dropOffUsers,
        dropOffRate,
      };
    });
  }

  it('calculates conversion rates correctly', () => {
    const result = buildFunnelResult([
      { users: 1000 },
      { users: 500 },
      { users: 200 },
    ]);

    expect(result[0].conversionRate).toBe(100);
    expect(result[1].conversionRate).toBe(50);
    expect(result[2].conversionRate).toBe(20);
  });

  it('calculates drop-off rates correctly', () => {
    const result = buildFunnelResult([
      { users: 1000 },
      { users: 500 },
      { users: 200 },
    ]);

    expect(result[0].dropOffUsers).toBe(0);
    expect(result[0].dropOffRate).toBe(0);
    expect(result[1].dropOffUsers).toBe(500);
    expect(result[1].dropOffRate).toBe(50);
    expect(result[2].dropOffUsers).toBe(300);
    expect(result[2].dropOffRate).toBe(60);
  });

  it('handles single-step funnel', () => {
    const result = buildFunnelResult([{ users: 800 }]);
    expect(result).toHaveLength(1);
    expect(result[0].conversionRate).toBe(80);
  });

  it('handles empty funnel', () => {
    const result = buildFunnelResult([]);
    expect(result).toHaveLength(0);
  });

  it('handles all users completing the funnel', () => {
    const result = buildFunnelResult([
      { users: 500 },
      { users: 500 },
      { users: 500 },
    ]);
    expect(result[2].dropOffUsers).toBe(0);
    expect(result[2].dropOffRate).toBe(0);
  });

  it('handles funnel where everyone drops off at step 2', () => {
    const result = buildFunnelResult([
      { users: 1000 },
      { users: 0 },
    ]);
    expect(result[1].users).toBe(0);
    expect(result[1].conversionRate).toBe(0);
    expect(result[1].dropOffUsers).toBe(1000);
    expect(result[1].dropOffRate).toBe(100);
  });
});