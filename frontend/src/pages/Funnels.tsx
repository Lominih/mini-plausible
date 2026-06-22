import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { funnelsApi, eventsApi } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { Funnel, FunnelStep, EventDefinition } from '../types';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';

export default function Funnels() {
  const { currentSiteId } = useSite();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [eventDefs, setEventDefs] = useState<EventDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [funnelName, setFunnelName] = useState('');
  const [stepEvents, setStepEvents] = useState<string[]>(['']);
  const [error, setError] = useState('');
  const [activeFunnel, setActiveFunnel] = useState<Funnel | null>(null);

  useEffect(() => {
    if (!currentSiteId) return;
    setLoading(true);
    Promise.all([
      funnelsApi.list(currentSiteId),
      eventsApi.list(),
    ])
      .then(([f, e]) => { setFunnels(f); setEventDefs(e); })
      .finally(() => setLoading(false));
  }, [currentSiteId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSiteId || !funnelName || stepEvents.filter(Boolean).length < 2) {
      setError('Please add at least 2 steps');
      return;
    }
    setError('');
    try {
      const funnel = await funnelsApi.create({
        siteId: currentSiteId,
        name: funnelName,
        steps: stepEvents.filter(Boolean).map((event) => ({ event })),
      });
      setFunnels((prev) => [...prev, funnel]);
      setFunnelName('');
      setStepEvents(['']);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create funnel');
    }
  };

  const addStep = () => setStepEvents((prev) => [...prev, '']);
  const removeStep = (idx: number) => setStepEvents((prev) => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, val: string) => setStepEvents((prev) => prev.map((s, i) => i === idx ? val : s));

  return (
    <Layout title="Funnels">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Funnels</h1>
          <p className="page-description">Visualize conversion through event sequences</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> New Funnel
        </button>
      </div>

      {showForm && (
        <div className="settings-section" style={{ marginBottom: 24 }}>
          <h2>Create Funnel</h2>
          {error && (
            <div style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.87rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Funnel Name</label>
              <input className="form-input" value={funnelName} onChange={(e) => setFunnelName(e.target.value)} placeholder="e.g., Purchase Flow" required style={{ maxWidth: 400 }} />
            </div>
            <div className="form-group">
              <label>Steps</label>
              {stepEvents.map((evt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={{ alignSelf: 'center', minWidth: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 600 }}>{idx + 1}</span>
                  <select
                    className="form-input"
                    value={evt}
                    onChange={(e) => updateStep(idx, e.target.value)}
                    style={{ maxWidth: 300 }}
                  >
                    <option value="">Select event...</option>
                    {eventDefs.map((ed) => (
                      <option key={ed.id} value={ed.event}>{ed.name} ({ed.event})</option>
                    ))}
                  </select>
                  {stepEvents.length > 1 && (
                    <button type="button" className="btn-icon" onClick={() => removeStep(idx)} style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addStep} style={{ marginTop: 4 }}>
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">Create Funnel</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : funnels.length === 0 ? (
        <EmptyState
          title="No funnels yet"
          description="Create a funnel to visualize step-by-step conversion"
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Create Funnel</button>}
        />
      ) : (
        <>
          {/* Funnel list */}
          <div className="site-grid" style={{ marginBottom: 32 }}>
            {funnels.map((f) => (
              <div
                key={f.id}
                className="site-card"
                onClick={() => setActiveFunnel(activeFunnel?.id === f.id ? null : f)}
                style={activeFunnel?.id === f.id ? { borderColor: 'var(--color-primary)', borderWidth: 2 } : {}}
              >
                <div className="site-name">{f.name}</div>
                <div className="site-domain">{f.steps.length} steps</div>
                <div className="site-stats">
                  <div>
                    <div className="site-stat-label">Completion</div>
                    <div className="site-stat-value">{f.steps.length > 0 ? `${(f.steps[f.steps.length - 1].rate).toFixed(1)}%` : '—'}</div>
                  </div>
                  <div>
                    <div className="site-stat-label">Total Visitors</div>
                    <div className="site-stat-value">{f.steps.length > 0 ? f.steps[0].count.toLocaleString() : '0'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active funnel visualization */}
          {activeFunnel && (
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">{activeFunnel.name}</div>
                <div className="chart-subtitle">Conversion funnel visualization</div>
              </div>
              <div className="funnel">
                {activeFunnel.steps.map((step: FunnelStep, idx: number) => {
                  const width = activeFunnel.steps[0].count > 0
                    ? (step.count / activeFunnel.steps[0].count) * 100
                    : 0;
                  return (
                    <div key={idx}>
                      {idx > 0 && (
                        <div className="funnel-connector">
                          ↓ {step.rate.toFixed(1)}% conversion
                        </div>
                      )}
                      <div className="funnel-step">
                        <div className="funnel-step-label">{step.event}</div>
                        <div className="funnel-bar-container">
                          <div
                            className="funnel-bar"
                            style={{
                              width: `${Math.max(width, 15)}%`,
                              background: `hsl(${250 + idx * 20}, 60%, ${55 - idx * 3}%)`,
                            }}
                          >
                            {step.count.toLocaleString()}
                          </div>
                        </div>
                        <div className="funnel-step-count">{step.count.toLocaleString()}</div>
                        <div className="funnel-step-rate">{width.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
