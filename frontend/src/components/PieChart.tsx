import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PieChartProps {
  data: { name: string; value: number }[];
  title?: string;
  subtitle?: string;
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = [
  '#5c45f2', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#6366f1', '#818cf8', '#4f46e5', '#4338ca',
  '#3730a3', '#6d28d9', '#7c3aed', '#a855f7',
];

export default function PieChartComponent({
  data,
  title,
  subtitle,
  colors = DEFAULT_COLORS,
  height = 300,
}: PieChartProps) {
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
            <RechartsPie>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                formatter={(value: any, name: any) => [Number(value).toLocaleString(), name]}
              />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ fontSize: 12, color: '#64748b' }}>{value}</span>
                )}
              />
            </RechartsPie>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

