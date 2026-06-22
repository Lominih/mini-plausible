import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';
import { pathsApi } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { PathNode, DateRange } from '../types';
import { GitBranch } from 'lucide-react';

const defaultDR: DateRange = { period: '30d', dateFrom: '', dateTo: '' };

function PathTree({ nodes, depth = 0, maxCount }: { nodes: PathNode[]; depth?: number; maxCount: number }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="path-tree">
      {nodes.map((node, idx) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expanded[idx] !== false;
        const barWidth = maxCount > 0 ? (node.count / maxCount) * 100 : 0;

        return (
          <div key={idx} className="path-node">
            <div
              className="path-node-row"
              style={{ paddingLeft: depth * 24 + 12 }}
              onClick={() => hasChildren && setExpanded((prev) => ({ ...prev, [idx]: !isExpanded }))}
            >
              {hasChildren ? (
                <span style={{ cursor: 'pointer', color: 'var(--color-text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', width: 16, textAlign: 'center' }}>▶</span>
              ) : (
                <span style={{ width: 16 }} />
              )}
              <span className="path-node-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                {depth === 0 && '/'}{node.path}
              </span>
              <span className="path-node-count">{node.count.toLocaleString()}</span>
              <div className="path-node-bar">
                <div className="path-node-bar-fill" style={{ width: `${barWidth}%` }} />
              </div>
            </div>
            {hasChildren && isExpanded && (
              <PathTree nodes={node.children!} depth={depth + 1} maxCount={maxCount} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Paths() {
  const { currentSiteId } = useSite();
  const [dr, setDr] = useState<DateRange>(defaultDR);
  const [paths, setPaths] = useState<PathNode[]>([]);
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
    pathsApi.get(currentSiteId, dr).then(setPaths).finally(() => setLoading(false));
  }, [currentSiteId, dr.dateFrom, dr.dateTo]);

  const maxCount = paths.length > 0 ? Math.max(...paths.map((p) => p.count), 1) : 1;

  return (
    <Layout title="Paths" headerExtra={<DateRangePicker value={dr} onChange={setDr} />}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>User Paths</h1>
          <p className="page-description">Visualize how users navigate through your site</p>
        </div>
      </div>

      {loading ? <Spinner /> : paths.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <GitBranch size={48} style={{ color: 'var(--color-text-muted)' }} />
          <h3>No path data</h3>
          <p>Path data will appear once you have visitor traffic</p>
        </div>
      ) : (
        <div className="chart-card">
          <PathTree nodes={paths} maxCount={maxCount} />
        </div>
      )}
    </Layout>
  );
}
