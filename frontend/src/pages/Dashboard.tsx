import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import MetricCard from '../components/MetricCard';
import LineChartComponent from '../components/LineChart';
import DateRangePicker from '../components/DateRangePicker';
import Spinner from '../components/Spinner';
import { analytics, sites } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { TimeSeriesPoint, SiteStats, DateRange } from '../types';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function Dashboard() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [visitors, setVisitors] = useState<TimeSeriesPoint[]>([]);
  const [pageviews, setPageviews] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dr.dateFrom && !dr.dateTo) {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      setDr({
        period: '30d',
        dateFrom: from.toISOString().split('T')[0],
        dateTo: now.toISOString().split('T')[0],
      });
      return;
    }
    if (!currentSiteId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, v, p] = await Promise.all([
          sites.stats(currentSiteId, dr),
          analytics.visitors(currentSiteId, dr),
          analytics.pageviews(currentSiteId, dr),
        ]);
        if (!cancelled) {
          setStats(s);
          setVisitors(v);
          setPageviews(p);
        }
      } catch {
        // handle silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  if (!currentSiteId) {
    return (
      <Layout title="Dashboard">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <h3>No site selected</h3>
          <p>Create or select a site to view analytics</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      {loading ? <Spinner /> : (
        <>
          <div className="metric-grid">
            <MetricCard label="Unique Visitors" value={fmtNum(stats?.visitors ?? 0)} change={stats?.visitorsChange} />
            <MetricCard label="Pageviews" value={fmtNum(stats?.pageviews ?? 0)} change={stats?.pageviewsChange} />
            <MetricCard label="Bounce Rate" value={`${(stats?.bounceRate ?? 0).toFixed(1)}%`} change={stats?.bounceRateChange} />
            <MetricCard label="Avg. Duration" value={`${(stats?.avgDuration ?? 0).toFixed(1)}s`} change={stats?.avgDurationChange} />
          </div>

          <div className="chart-grid">
            <LineChartComponent
              data={visitors}
              title="Visitors"
              lines={[{ key: 'value', color: '#5c45f2', name: 'Visitors' }]}
            />
            <LineChartComponent
              data={pageviews}
              title="Pageviews"
              lines={[{ key: 'value', color: '#8b5cf6', name: 'Pageviews' }]}
            />
          </div>
        </>
      )}
    </Layout>
  );
}
