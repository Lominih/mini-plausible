import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { eventsApi } from '../api/client';
import type { EventDefinition } from '../types';
import { format } from 'date-fns';
import { Layers, Plus, Trash2 } from 'lucide-react';

export default function Events() {
  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    try {
      const data = await eventsApi.list();
      setEvents(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEvent) return;
    setError('');
    try {
      await eventsApi.create({ name: newName, event: newEvent });
      setNewName('');
      setNewEvent('');
      setShowForm(false);
      fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event definition?')) return;
    try {
      await eventsApi.delete(id);
      fetchEvents();
    } catch {
      // silently fail
    }
  };

  return (
    <Layout title="Events">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Custom Events</h1>
          <p className="page-description">Track custom user interactions on your site</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> New Event
        </button>
      </div>

      {showForm && (
        <div className="settings-section" style={{ marginBottom: 24 }}>
          <h2>Create Event Definition</h2>
          {error && (
            <div style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.87rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Event Name</label>
              <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Sign Up" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Event Key</label>
              <input className="form-input" value={newEvent} onChange={(e) => setNewEvent(e.target.value)} placeholder="e.g., signup" required />
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : events.length === 0 ? (
        <EmptyState
          icon={<Layers size={48} />}
          title="No events defined"
          description="Create custom event definitions to track user interactions"
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Create Event</button>}
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event Key</th>
                <th>Count</th>
                <th>Created</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 500 }}>{ev.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.87rem', color: 'var(--color-primary)' }}>{ev.event}</td>
                  <td>{(ev.count ?? 0).toLocaleString()}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>
                    {(() => { try { return format(new Date(ev.createdAt), 'MMM d, yyyy'); } catch { return ev.createdAt; } })()}
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => handleDelete(ev.id)} style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
