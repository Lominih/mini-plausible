import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Spinner from '../components/Spinner';
import { sites } from '../api/client';
import { useSite } from '../hooks/useSite';
import type { Site } from '../types';
import { Copy, Check, Download } from 'lucide-react';
import { exportApi } from '../api/client';

export default function Settings() {
  const { currentSite, currentSiteId, refreshSites } = useSite();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (currentSite) {
      setName(currentSite.name);
      setDomain(currentSite.domain);
      setTimezone(currentSite.timezone || 'UTC');
    }
  }, [currentSite]);

  if (!currentSite || !currentSiteId) {
    return (
      <Layout title="Settings">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <h3>No site selected</h3>
        </div>
      </Layout>
    );
  }

  const embedCode = `<script defer data-domain="${domain}" src="/js/script.js"></script>`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await sites.update(currentSiteId, { name, domain, timezone });
      await refreshSites();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail) return;
    setAddingMember(true);
    try {
      await sites.addMember(currentSiteId, { email: memberEmail, role: memberRole });
      setMemberEmail('');
      await refreshSites();
    } catch {
      // silently fail
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <Layout title="Settings">
      {/* Site settings */}
      <div className="settings-section">
        <h2>Site Settings</h2>
        <div className="settings-row">
          <label>Site Name</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="settings-row">
          <label>Domain</label>
          <input className="form-input" value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>
        <div className="settings-row">
          <label>Timezone</label>
          <select className="form-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'].map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Embed code */}
      <div className="settings-section">
        <h2>Embed Code</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12, fontSize: '0.93rem' }}>
          Add this snippet to your website's <code style={{ background: 'var(--color-surface-hover)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>&lt;head&gt;</code> tag:
        </p>
        <div style={{ position: 'relative' }}>
          <pre className="embed-code">{embedCode}</pre>
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleCopyEmbed}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="settings-section">
        <h2>Members</h2>
        {currentSite.members && currentSite.members.length > 0 && (
          <table className="data-table" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {currentSite.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user?.email || m.userId}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      background: m.role === 'owner' ? 'var(--color-primary-light)' : m.role === 'admin' ? 'var(--color-info-light)' : 'var(--color-surface-hover)',
                      color: m.role === 'owner' ? 'var(--color-primary)' : m.role === 'admin' ? 'var(--color-info)' : 'var(--color-text-secondary)',
                    }}>
                      {m.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input className="form-input" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="member@example.com" required style={{ width: 280 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Role</label>
            <select className="form-input" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} style={{ width: 120 }}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-secondary" disabled={addingMember}>
            {addingMember ? 'Adding...' : 'Add Member'}
          </button>
        </form>
      </div>

      {/* Data export */}
      <div className="settings-section">
        <h2>Data Export</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12, fontSize: '0.93rem' }}>
          Export all analytics data for this site
        </p>
        <a href={exportApi.downloadUrl(currentSiteId)} className="btn btn-secondary" download>
          <Download size={16} /> Export CSV
        </a>
      </div>
    </Layout>
  );
}
