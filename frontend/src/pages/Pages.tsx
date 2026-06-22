import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import DataTable from '../components/DataTable';
import DateRangePicker from '../components/DateRangePicker';
import Spinner from '../components/Spinner';
import { analytics } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { PageStat, DateRange } from '../types';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

export default function Pages() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [pages, setPages] = useState<PageStat[]>([]);
  const [entryPages, setEntryPages] = useState<PageStat[]>([]);
  const [exitPages, setExitPages] = useState<PageStat[]>([]);
  const [tab, setTab] = useState<'pages' | 'entry' | 'exit'>('pages');
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
    Promise.all([
      analytics.pages(currentSiteId, dr),
      analytics.entryPages(currentSiteId, dr),
      analytics.exitPages(currentSiteId, dr),
    ])
      .then(([p, e, ex]) => { setPages(p); setEntryPages(e); setExitPages(ex); })
      .finally(() => setLoading(false));
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  const activeData = tab === 'pages' ? pages : tab === 'entry' ? entryPages : exitPages;
  const maxPv = Math.max(...activeData.map((d) => d.pageviews), 1);

  return (
    <Layout title="Pages" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      {loading ? <Spinner /> : (
        <>
          <div className="tabs">
            <button className={`tab ${tab === 'pages' ? 'active' : ''}`} onClick={() => setTab('pages')}>Top Pages</button>
            <button className={`tab ${tab === 'entry' ? 'active' : ''}`} onClick={() => setTab('entry')}>Entry Pages</button>
            <button className={`tab ${tab === 'exit' ? 'active' : ''}`} onClick={() => setTab('exit')}>Exit Pages</button>
          </div>
          <DataTable
            data={activeData.map((d) => ({ ...d, value: d.pageviews }))}
            columns={[
              {
                key: 'page',
                label: 'Page',
                sortable: true,
                render: (item) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.87rem' }}>{item.page}</span>
                ),
              },
              {
                key: 'pageviews',
                label: 'Pageviews',
                sortable: true,
                align: 'right',
                render: (item) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                    <span>{item.pageviews.toLocaleString()}</span>
                    <div className="table-bar" style={{ width: 100 }}>
                      <div className="table-bar-fill" style={{ width: `${(item.pageviews / maxPv) * 100}%` }} />
                    </div>
                  </div>
                ),
              },
              { key: 'visitors', label: 'Visitors', sortable: true, align: 'right' },
            ]}
            maxRows={100}
          />
        </>
      )}
    </Layout>
  );
}
