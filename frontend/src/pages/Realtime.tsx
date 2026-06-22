import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout/Layout';
import MetricCard from '../components/MetricCard';
import BarChartComponent from '../components/BarChart';
import DataTable from '../components/DataTable';
import Spinner from '../components/Spinner';
import { analytics } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { RealtimeData } from '../types';

export default function Realtime() {
  const { currentSiteId } = useSite();
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{ time: string; visitors: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!currentSiteId) return;

    const fetchRealtime = async () => {
      try {
        const d = await analytics.realtime(currentSiteId);
        setData(d);
        setHistory((prev) => {
          const next = [...prev, { time: new Date().toLocaleTimeString(), visitors: d.visitors }];
          return next.slice(-30); // last 30 readings
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchRealtime();
    intervalRef.current = setInterval(fetchRealtime, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentSiteId]);

  if (!currentSiteId) {
    return (
      <Layout title="Realtime">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <h3>No site selected</h3>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Realtime">
      {loading ? <Spinner /> : data && (
        <>
          <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <MetricCard label="Live Visitors" value={data.visitors} />
            <MetricCard label="Top Source" value={data.sources[0]?.name || 'Direct'} />
            <MetricCard label="Top Country" value={data.countries[0]?.country || 'Unknown'} />
          </div>

          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div className="chart-header">
              <div className="chart-title">Visitors Over Time (last 5 min)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Live — refreshes every 5s</span>
              </div>
            </div>
            <div style={{ height: 200 }}>
              {history.length > 1 ? (
                <BarChartComponent
                  data={history.map((h) => ({ name: h.time, value: h.visitors }))}
                  color="#16a34a"
                  height={200}
                />
              ) : (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 60 }}>
                  Collecting data...
                </p>
              )}
            </div>
          </div>

          <div className="chart-grid">
            <DataTable
              title="Current Pages"
              data={data.pages.map((p) => ({ page: p.page, visitors: p.visitors }))}
              columns={[
                { key: 'page', label: 'Page', sortable: true },
                { key: 'visitors', label: 'Visitors', sortable: true, align: 'right' },
              ]}
              barKey="visitors"
              showBar
              maxRows={10}
            />
            <DataTable
              title="Active Sources"
              data={data.sources.map((s) => ({ name: s.name, visitors: s.visitors }))}
              columns={[
                { key: 'name', label: 'Source', sortable: true },
                { key: 'visitors', label: 'Visitors', sortable: true, align: 'right' },
              ]}
              barKey="visitors"
              showBar
              maxRows={10}
            />
          </div>
        </>
      )}
    </Layout>
  );
}


