import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import DataTable from '../components/DataTable';
import PieChartComponent from '../components/PieChart';
import BarChartComponent from '../components/BarChart';
import DateRangePicker from '../components/DateRangePicker';
import Spinner from '../components/Spinner';
import { analytics } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { BrowserStat, DateRange } from '../types';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

export default function Browsers() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [browsers, setBrowsers] = useState<BrowserStat[]>([]);
  const [os, setOs] = useState<{ os: string; visitors: number; percentage: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pie' | 'bar'>('pie');

  useEffect(() => {
    if (!dr.dateFrom && !dr.dateTo) {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      setDr({ period: '30d', dateFrom: from.toISOString().split('T')[0], dateTo: now.toISOString().split('T')[0] });
      return;
    }
    if (!currentSiteId) return;
    setLoading(true);
    Promise.all([
      analytics.browsers(currentSiteId, dr),
      analytics.os(currentSiteId, dr),
    ])
      .then(([b, o]) => { setBrowsers(b); setOs(o); })
      .finally(() => setLoading(false));
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  const browserChartData = browsers.map((b) => ({ name: b.browser, value: b.visitors }));
  const osChartData = os.map((o) => ({ name: o.os, value: o.visitors }));

  return (
    <Layout title="Browsers & OS" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button className={`btn btn-sm ${view === 'pie' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('pie')}>Pie Chart</button>
            <button className={`btn btn-sm ${view === 'bar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('bar')}>Bar Chart</button>
          </div>

          <div className="chart-grid">
            {view === 'pie' ? (
              <PieChartComponent data={browserChartData} title="Browser Distribution" height={320} />
            ) : (
              <BarChartComponent data={browserChartData} title="Browser Distribution" color="#5c45f2" height={320} />
            )}
            {view === 'pie' ? (
              <PieChartComponent data={osChartData} title="Operating Systems" height={320} />
            ) : (
              <BarChartComponent data={osChartData} title="Operating Systems" color="#8b5cf6" height={320} />
            )}
          </div>

          <div className="chart-grid">
            <DataTable
              title="Browsers"
              data={browsers.map((b) => ({ ...b, value: b.visitors }))}
              columns={[
                { key: 'browser', label: 'Browser', sortable: true },
                { key: 'visitors', label: 'Visitors', sortable: true, align: 'right' },
                { key: 'percentage', label: 'Share', sortable: true, align: 'right', render: (item) => `${item.percentage.toFixed(1)}%` },
              ]}
              showBar
              barKey="visitors"
            />
            <DataTable
              title="Operating Systems"
              data={os.map((o) => ({ ...o, value: o.visitors }))}
              columns={[
                { key: 'os', label: 'OS', sortable: true },
                { key: 'visitors', label: 'Visitors', sortable: true, align: 'right' },
                { key: 'percentage', label: 'Share', sortable: true, align: 'right', render: (item) => `${item.percentage.toFixed(1)}%` },
              ]}
              showBar
              barKey="visitors"
            />
          </div>
        </>
      )}
    </Layout>
  );
}
