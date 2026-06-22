import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import DataTable from '../components/DataTable';
import BarChartComponent from '../components/BarChart';
import DateRangePicker from '../components/DateRangePicker';
import Spinner from '../components/Spinner';
import { analytics } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { Source, DateRange } from '../types';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

export default function Sources() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [data, setData] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

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
    analytics.sources(currentSiteId, dr).then(setData).finally(() => setLoading(false));
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  const chartData = data.slice(0, 10).map((s) => ({ name: s.name, value: s.visitors }));
  const maxVisitors = Math.max(...data.map((d) => d.visitors), 1);

  return (
    <Layout title="Sources" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      {loading ? <Spinner /> : (
        <>
          <BarChartComponent
            data={chartData}
            title="Top Sources"
            color="#5c45f2"
            height={300}
          />
          <DataTable
            title="All Referrer Sources"
            data={data.map((s) => ({ ...s, value: s.visitors }))}
            columns={[
              { key: 'name', label: 'Source', sortable: true },
              {
                key: 'visitors',
                label: 'Visitors',
                sortable: true,
                align: 'right',
                render: (item) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="table-bar" style={{ width: 120 }}>
                      <div className="table-bar-fill" style={{ width: `${(item.visitors / maxVisitors) * 100}%` }} />
                    </div>
                    <span>{item.visitors.toLocaleString()}</span>
                  </div>
                ),
              },
              { key: 'pageviews', label: 'Pageviews', sortable: true, align: 'right' },
            ]}
            showBar={false}
            maxRows={50}
          />
        </>
      )}
    </Layout>
  );
}
