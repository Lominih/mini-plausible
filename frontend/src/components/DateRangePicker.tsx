import { useState, useCallback, useRef, useEffect } from 'react';
import { format, subDays, startOfDay } from 'date-fns';

const PERIODS = [
  { label: '7 days', value: '7d', days: 7 },
  { label: '30 days', value: '30d', days: 30 },
  { label: '90 days', value: '90d', days: 90 },
  { label: 'Custom', value: 'custom', days: 0 },
];

interface DateRangePickerProps {
  value: { period: string; dateFrom?: string; dateTo?: string };
  onChange: (range: { period: string; dateFrom?: string; dateTo?: string }) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [customFrom, setCustomFrom] = useState(value.dateFrom || '');
  const [customTo, setCustomTo] = useState(value.dateTo || '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activePeriod = PERIODS.find((p) => p.value === value.period) || PERIODS[0];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectPeriod = useCallback(
    (period: string, days: number) => {
      if (period === 'custom') {
        setOpen(true);
        return;
      }
      const dateTo = format(new Date(), 'yyyy-MM-dd');
      const dateFrom = format(subDays(new Date(), days), 'yyyy-MM-dd');
      onChange({ period, dateFrom, dateTo });
      setOpen(false);
    },
    [onChange]
  );

  const applyCustom = () => {
    onChange({ period: 'custom', dateFrom: customFrom, dateTo: customTo });
    setOpen(false);
  };

  const displayLabel = value.period === 'custom' && value.dateFrom && value.dateTo
    ? `${value.dateFrom} → ${value.dateTo}`
    : activePeriod.label;

  return (
    <div className="date-range-picker-wrapper" ref={ref} style={{ position: 'relative' }}>
      <div className="date-range-picker" onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span style={{ fontSize: '0.87rem', fontWeight: 500 }}>{displayLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          padding: 12, minWidth: 240, zIndex: 300,
        }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => selectPeriod(p.value, p.days)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                background: value.period === p.value ? 'var(--color-primary-light)' : 'transparent',
                color: value.period === p.value ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: value.period === p.value ? 600 : 400,
                fontSize: '0.93rem', marginBottom: 2,
              }}
            >
              {p.label}
            </button>
          ))}
          {value.period === 'custom' && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="date"
                  className="form-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
                <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)' }}>→</span>
                <input
                  type="date"
                  className="form-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <button className="btn btn-primary btn-sm btn-full" onClick={applyCustom}>Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
