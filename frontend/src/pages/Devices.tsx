import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import DataTable from '../components/DataTable';
import PieChartComponent from '../components/PieChart';
import BarChartComponent from '../components/BarChart';
import DateRangePicker from '../components/DateRangePicker';
import Spinner from '../components/Spinner';
import { analytics } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { DeviceStat, DateRange } from '../types';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

export default function Devices() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [devices, setDevices] = useState<DeviceStat[]>([]);
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
    analytics.devices(currentSiteId, dr).then(setDevices).finally(() => setLoading(false));
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  const chartData = devices.map((d) => ({ name: d.device, value: d.visitors }));
  const maxVisitors = Math.max(...devices.map((d) => d.visitors), 1);

  return (
    <Layout title="Devices" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button className={`btn btn-sm ${view === 'pie' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('pie')}>Pie Chart</button>
            <button className={`btn btn-sm ${view === 'bar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('bar')}>Bar Chart</button>
          </div>

          {view === 'pie' ? (
            <PieChartComponent data={chartData} title="Device Breakdown" height={320} />
          ) : (
            <BarChartComponent data={chartData} title="Device Breakdown" color="#5c45f2" height={320} />
          )}

          <DataTable
            title="Device Details"
            data={devices.map((d) => ({ ...d, value: d.visitors }))}
            columns={[
              { key: 'device', label: 'Device', sortable: true },
              {
                key: 'visitors',
                label: 'Visitors',
                sortable: true,
                align: 'right',
                render: (item) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                    <span>{item.visitors.toLocaleString()}</span>
                    <div className="table-bar" style={{ width: 100 }}>
                      <div className="table-bar-fill" style={{ width: `${(item.visitors / maxVisitors) * 100}%` }} />
                    </div>
                  </div>
                ),
              },
              { key: 'percentage', label: 'Share', sortable: true, align: 'right', render: (item) => `${item.percentage.toFixed(1)}%` },
            ]}
            showBar={false}
          />
        </>
      )}
    </Layout>
  );
}
