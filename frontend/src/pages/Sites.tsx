import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { sites } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { Site } from '../types';
import { Plus, Trash2, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Sites() {
  const { allSites, refreshSites, setCurrentSiteId } = useSite();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    refreshSites().finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDomain) return;
    setError('');
    try {
      const site = await sites.create({ name: newName, domain: newDomain });
      setNewName('');
      setNewDomain('');
      setShowForm(false);
      await refreshSites();
      setCurrentSiteId(site.id);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create site');
    }
  };

  const handleDelete = async (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this site? This cannot be undone.')) return;
    try {
      await sites.delete(siteId);
      await refreshSites();
    } catch {
      // silently fail
    }
  };

  const handleSelectSite = (siteId: string) => {
    setCurrentSiteId(siteId);
    navigate('/dashboard');
  };

  return (
    <Layout title="Sites">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Sites</h1>
          <p className="page-description">Manage your tracked websites</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Add Site
        </button>
      </div>

      {showForm && (
        <div className="settings-section" style={{ marginBottom: 24 }}>
          <h2>Add New Site</h2>
          {error && (
            <div style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.87rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Site Name</label>
              <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Website" required style={{ minWidth: 200 }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Domain</label>
              <input className="form-input" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" required style={{ minWidth: 200 }} />
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : allSites.length === 0 ? (
        <EmptyState
          icon={<Globe size={48} />}
          title="No sites yet"
          description="Add your first website to start tracking analytics"
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add Site</button>}
        />
      ) : (
        <div className="site-grid">
          {allSites.map((site: Site) => (
            <div key={site.id} className="site-card" onClick={() => handleSelectSite(site.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="site-name">{site.name}</div>
                  <div className="site-domain">{site.domain}</div>
                </div>
                <button
                  className="btn-icon"
                  onClick={(e) => handleDelete(e, site.id)}
                  style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
                  title="Delete site"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="site-stats">
                <div>
                  <div className="site-stat-label">Created</div>
                  <div className="site-stat-value" style={{ fontSize: '0.87rem' }}>
                    {(() => {
                      try {
                        return new Date(site.createdAt).toLocaleDateString();
                      } catch {
                        return '—';
                      }
                    })()}
                  </div>
                </div>
                <div>
                  <div className="site-stat-label">Members</div>
                  <div className="site-stat-value">{site.members?.length ?? 0}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
