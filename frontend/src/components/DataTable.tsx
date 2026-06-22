import { useState, useMemo } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  maxRows?: number;
  showBar?: boolean;
  barKey?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  title,
  maxRows = 25,
  showBar = false,
  barKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...data];
    if (sortKey) {
      arr.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal || '');
        const bStr = String(bVal || '');
        return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    return arr.slice(0, maxRows);
  }, [data, sortKey, sortDir, maxRows]);

  const maxVal = showBar && barKey
    ? Math.max(...data.map((d) => Number(d[barKey]) || 0), 1)
    : 1;

  return (
    <div className="table-card">
      {title && (
        <div className="table-header">
          <span className="table-title">{title}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {data.length} results
          </span>
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                style={{
                  textAlign: col.align || 'left',
                  width: col.width,
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                }}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                No data available
              </td>
            </tr>
          ) : (
            sorted.map((item, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(item, idx) : (
                      showBar && barKey && col.key === barKey ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="table-bar" style={{ flex: 1, maxWidth: 120 }}>
                            <div
                              className="table-bar-fill"
                              style={{ width: `${(Number(item[col.key]) || 0) / maxVal * 100}%` }}
                            />
                          </div>
                          <span>{Number(item[col.key]).toLocaleString()}</span>
                        </div>
                      ) : (
                        String(item[col.key] ?? '')
                      )
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
