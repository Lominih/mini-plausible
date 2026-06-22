import type {
  User,
  AuthResponse,
  Site,
  SiteStats,
  TimeSeriesPoint,
  Source,
  PageStat,
  CountryStat,
  BrowserStat,
  DeviceStat,
  OsStat,
  RealtimeData,
  EventDefinition,
  Funnel,
  PathNode,
  DateRange,
  UtmStat,
} from '../types';

const API_BASE = '/api';

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');
let refreshPromise: Promise<string> | null = null;

function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function doRefresh(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Refresh failed');
  }
  const data: AuthResponse = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!accessToken) throw new Error('Not authenticated');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    headers['Authorization'] = `Bearer ${newToken}`;
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&');
}

function formatDateRange(dr: DateRange): string {
  return buildQueryString({
    period: dr.period,
    date: dr.date,
    date_from: dr.dateFrom,
    date_to: dr.dateTo,
  });
}

// Auth
export const auth = {
  register: (data: { email: string; password: string; name?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<User>('/auth/me'),
  logout: () => clearTokens(),
  setTokens,
  isAuthenticated: () => !!accessToken,
};

// Sites
export const sites = {
  list: () => request<Site[]>('/sites'),
  create: (data: { name: string; domain: string; timezone?: string }) =>
    request<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; domain: string; timezone: string }>) =>
    request<Site>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/sites/${id}`, { method: 'DELETE' }),
  addMember: (siteId: string, data: { email: string; role: string }) =>
    request<void>(`/sites/${siteId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  stats: (siteId: string, dr?: DateRange) =>
    request<SiteStats>(`/sites/${siteId}/stats${dr ? formatDateRange(dr) : ''}`),
};

// Analytics
export const analytics = {
  realtime: (siteId: string) =>
    request<RealtimeData>(`/analytics/realtime?siteId=${siteId}`),
  visitors: (siteId: string, dr: DateRange) =>
    request<TimeSeriesPoint[]>(`/analytics/visitors?siteId=${siteId}${formatDateRange(dr)}`),
  pageviews: (siteId: string, dr: DateRange) =>
    request<TimeSeriesPoint[]>(`/analytics/pageviews?siteId=${siteId}${formatDateRange(dr)}`),
  sources: (siteId: string, dr: DateRange) =>
    request<Source[]>(`/analytics/sources?siteId=${siteId}${formatDateRange(dr)}`),
  pages: (siteId: string, dr: DateRange) =>
    request<PageStat[]>(`/analytics/pages?siteId=${siteId}${formatDateRange(dr)}`),
  countries: (siteId: string, dr: DateRange) =>
    request<CountryStat[]>(`/analytics/countries?siteId=${siteId}${formatDateRange(dr)}`),
  browsers: (siteId: string, dr: DateRange) =>
    request<BrowserStat[]>(`/analytics/browsers?siteId=${siteId}${formatDateRange(dr)}`),
  os: (siteId: string, dr: DateRange) =>
    request<OsStat[]>(`/analytics/os?siteId=${siteId}${formatDateRange(dr)}`),
  devices: (siteId: string, dr: DateRange) =>
    request<DeviceStat[]>(`/analytics/devices?siteId=${siteId}${formatDateRange(dr)}`),
  entryPages: (siteId: string, dr: DateRange) =>
    request<PageStat[]>(`/analytics/entry-pages?siteId=${siteId}${formatDateRange(dr)}`),
  exitPages: (siteId: string, dr: DateRange) =>
    request<PageStat[]>(`/analytics/exit-pages?siteId=${siteId}${formatDateRange(dr)}`),
  utm: (siteId: string, dr: DateRange) =>
    request<UtmStat[]>(`/analytics/utm?siteId=${siteId}${formatDateRange(dr)}`),
};

// Events
export const eventsApi = {
  list: () => request<EventDefinition[]>('/events/definitions'),
  create: (data: { name: string; event: string }) =>
    request<EventDefinition>('/events/definitions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; event: string }>) =>
    request<EventDefinition>(`/events/definitions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/events/definitions/${id}`, { method: 'DELETE' }),
};

// Funnels
export const funnelsApi = {
  list: (siteId: string) =>
    request<Funnel[]>(`/analytics/funnels?siteId=${siteId}`),
  create: (data: { siteId: string; name: string; steps: { event: string }[] }) =>
    request<Funnel>('/analytics/funnels', { method: 'POST', body: JSON.stringify(data) }),
};

// Paths
export const pathsApi = {
  get: (siteId: string, dr?: DateRange) =>
    request<PathNode[]>(`/analytics/paths?siteId=${siteId}${dr ? formatDateRange(dr) : ''}`),
};

// Export
export const exportApi = {
  downloadUrl: (siteId: string, format: string = 'csv') =>
    `${API_BASE}/export/${siteId}?format=${format}`,
};

export { clearTokens };
