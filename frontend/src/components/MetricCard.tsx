interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  suffix?: string;
}

export default function MetricCard({ label, value, change, suffix }: MetricCardProps) {
  const trendClass = change === undefined ? 'neutral' : change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const arrow = change === undefined ? '' : change > 0 ? '↑' : change < 0 ? '↓' : '–';
  const changeStr = change !== undefined
    ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
    : '';

  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}{suffix}
      </div>
      {change !== undefined && (
        <div className={`metric-trend ${trendClass}`}>
          {arrow} {changeStr} vs previous period
        </div>
      )}
    </div>
  );
}
