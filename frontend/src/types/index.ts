export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Site {
  id: string;
  name: string;
  domain: string;
  timezone: string;
  createdAt: string;
  members?: SiteMember[];
}

export interface SiteMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'viewer';
  user?: User;
}

export interface SiteStats {
  visitors: number;
  pageviews: number;
  bounceRate: number;
  avgDuration: number;
  visitorsChange: number;
  pageviewsChange: number;
  bounceRateChange: number;
  avgDurationChange: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  value2?: number;
}

export interface Source {
  name: string;
  visitors: number;
  pageviews: number;
}

export interface PageStat {
  page: string;
  pageviews: number;
  visitors: number;
}

export interface CountryStat {
  country: string;
  countryCode: string;
  visitors: number;
  pageviews: number;
}

export interface BrowserStat {
  browser: string;
  visitors: number;
  percentage: number;
}

export interface DeviceStat {
  device: string;
  visitors: number;
  percentage: number;
}

export interface OsStat {
  os: string;
  visitors: number;
  percentage: number;
}

export interface RealtimeData {
  visitors: number;
  pages: { page: string; visitors: number }[];
  sources: { name: string; visitors: number }[];
  countries: { country: string; visitors: number }[];
  timestamp: string;
}

export interface EventDefinition {
  id: string;
  name: string;
  event: string;
  properties?: Record<string, unknown>;
  createdAt: string;
  count?: number;
}

export interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  createdAt: string;
}

export interface FunnelStep {
  event: string;
  count: number;
  rate: number;
}

export interface PathNode {
  path: string;
  count: number;
  children?: PathNode[];
}

export interface DateRange {
  period: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UtmStat {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  visitors: number;
  pageviews: number;
}
