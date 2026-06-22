import { DateRange, ComparisonResult } from "../types/analytics";

export function computePreviousPeriod(currentRange: DateRange): DateRange {
  const duration = currentRange.to.getTime() - currentRange.from.getTime();
  return {
    from: new Date(currentRange.from.getTime() - duration),
    to: new Date(currentRange.from.getTime() - 1),
  };
}

export function calculateChange(current: number, previous: number): number {
  return current - previous;
}

export function calculateChangePercentage(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export function buildComparisonResult<T extends Record<string, number>>(
  currentData: T,
  previousData: T
): ComparisonResult<T> {
  const keys = Object.keys(currentData) as (keyof T)[];
  const change: Record<string, number> = {};
  const changePercentage: Record<string, number> = {};

  for (const key of keys) {
    const cur = currentData[key] as number;
    const prev = previousData[key] as number;
    change[key as string] = calculateChange(cur, prev);
    changePercentage[key as string] = calculateChangePercentage(cur, prev);
  }

  return {
    current: currentData,
    previous: previousData,
    change: change as unknown as T,
    changePercentage: changePercentage as unknown as T,
  };
}

export function buildTimeSeriesComparison(
  currentSeries: Array<{ date: string; value: number }>,
  previousSeries: Array<{ date: string; value: number }>
): {
  current: Array<{ date: string; value: number }>;
  previous: Array<{ date: string; value: number }>;
  change: number;
  changePercentage: number;
} {
  const currentTotal = currentSeries.reduce((sum, e) => sum + e.value, 0);
  const previousTotal = previousSeries.reduce((sum, e) => sum + e.value, 0);

  return {
    current: currentSeries,
    previous: previousSeries,
    change: calculateChange(currentTotal, previousTotal),
    changePercentage: calculateChangePercentage(currentTotal, previousTotal),
  };
}