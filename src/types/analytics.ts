export type Period = "realtime" | "7d" | "30d" | "90d" | "custom";

export interface AnalyticsQueryParams {
  siteId: string;
  period: Period;
  date_from?: string;
  date_to?: string;
  filters?: Record<string, string>;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface TimeSeriesEntry {
  date: string;
  value: number;
}

export interface BreakdownEntry {
  name: string;
  count: number;
  percentage: number;
}

export interface ComparisonResult<T> {
  current: T;
  previous: T;
  change: number;
  changePercentage: number;
}

export interface RealtimeStats {
  onlineVisitors: number;
  pageviewsLast5Min: number;
}

export interface SiteStats {
  totalPageviews: number;
  totalVisitors: number;
  totalVisits: number;
  bounceRate: number;
  visitDuration: number;
}

export interface AuthPayload {
  userId: string;
  email: string;
  siteAccess?: string[];
}

export interface AuthenticatedRequest extends Express.Request {
  user?: AuthPayload;
  siteId?: string;
}