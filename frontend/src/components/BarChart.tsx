import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BarChartProps {
  data: { name: string; value: number; [key: string]: string | number }[];
  title?: string;
  subtitle?: string;
  color?: string;
  height?: number;
  layout?: 'horizontal' | 'vertical';
  dataKey?: string;
  nameKey?: string;
}

export default function BarChartComponent({
  data,
  title,
  subtitle,
  color = '#5c45f2',
  height = 280,
  layout = 'horizontal',
  dataKey = 'value',
  nameKey = 'name',
}: BarChartProps) {
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
            <RechartsBar
              data={data}
              layout={layout}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              {layout === 'horizontal' ? (
                <>
                  <XAxis dataKey={nameKey} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={50} />
                </>
              ) : (
                <>
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={120} />
                </>
              )}
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                }}
              />
              <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
            </RechartsBar>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
