import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import DataTable from '../components/DataTable';
import BarChartComponent from '../components/BarChart';
import DateRangePicker from '../components/DateRangePicker';
import Spinner from '../components/Spinner';
import { analytics } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { CountryStat, DateRange } from '../types';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', JP: '🇯🇵', CN: '🇨🇳', BR: '🇧🇷', IN: '🇮🇳',
  CA: '🇨🇦', AU: '🇦🇺', KR: '🇰🇷', IT: '🇮🇹', ES: '🇪🇸', NL: '🇳🇱', SE: '🇸🇪', RU: '🇷🇺',
  PL: '🇵🇱', PT: '🇵🇹', CH: '🇨🇭', AT: '🇦🇹', BE: '🇧🇪', DK: '🇩🇰', NO: '🇳🇴', FI: '🇫🇮',
  CZ: '🇨🇿', RO: '🇷🇴', HU: '🇭🇺', IE: '🇮🇪', NZ: '🇳🇿', MX: '🇲🇽', AR: '🇦🇷', CL: '🇨🇱',
  ZA: '🇿🇦', SG: '🇸🇬', HK: '🇭🇰', TW: '🇹🇼', TH: '🇹🇭', ID: '🇮🇩', MY: '🇲🇾', PH: '🇵🇭',
};

function countryCodeToFlag(code: string) {
  if (!code || code.length !== 2) return '🌍';
  return COUNTRY_FLAGS[code.toUpperCase()] || '🌍';
}

export default function Countries() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [data, setData] = useState<CountryStat[]>([]);
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
    analytics.countries(currentSiteId, dr).then(setData).finally(() => setLoading(false));
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  const chartData = data.slice(0, 15).map((c) => ({ name: `${countryCodeToFlag(c.countryCode)} ${c.country}`, value: c.visitors }));
  const maxVisitors = Math.max(...data.map((d) => d.visitors), 1);

  return (
    <Layout title="Countries" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      {loading ? <Spinner /> : (
        <>
          <BarChartComponent
            data={chartData}
            title="Top Countries"
            color="#5c45f2"
            height={350}
            layout="horizontal"
          />
          <DataTable
            title="All Countries"
            data={data.map((c) => ({ ...c, flag: countryCodeToFlag(c.countryCode) }))}
            columns={[
              {
                key: 'country',
                label: 'Country',
                sortable: true,
                render: (item) => (
                  <span>{countryCodeToFlag(item.countryCode)} {item.country}</span>
                ),
              },
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
              { key: 'pageviews', label: 'Pageviews', sortable: true, align: 'right' },
            ]}
            maxRows={50}
          />
        </>
      )}
    </Layout>
  );
}
