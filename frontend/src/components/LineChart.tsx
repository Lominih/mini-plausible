import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TimeSeriesPoint } from '../types';
import { format, parseISO } from 'date-fns';

interface LineChartProps {
  data: TimeSeriesPoint[];
  title?: string;
  subtitle?: string;
  lines?: { key: string; color: string; name: string }[];
  height?: number;
}

const defaultLines = [
  { key: 'value', color: '#5c45f2', name: 'Visitors' },
];

export default function LineChartComponent({
  data,
  title,
  subtitle,
  lines = defaultLines,
  height = 280,
}: LineChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    dateLabel: (() => {
      try {
        return format(parseISO(d.date), 'MMM d');
      } catch {
        return d.date;
      }
    })(),
  }));

  return (
    <div className="chart-card">
      {(title || subtitle) && (
        <div className="chart-header">
          <div>
            {title && <div className="chart-title">{title}</div>}
            {subtitle && <div className="chart-subtitle">{subtitle}</div>}
          </div>
        </div>
      )}
      <div className="chart-wrapper" style={{ height }}>
        {data.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p style={{ color: 'var(--color-text-muted)' }}>No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={50} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                }}
              />
              {lines.length > 1 && <Legend />}
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </RechartsLine>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
