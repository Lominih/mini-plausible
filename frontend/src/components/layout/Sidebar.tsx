import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Globe, Radio, Settings, BarChart3, Users, MapPin, Monitor, Smartphone, Layers, GitBranch, Filter } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/realtime', label: 'Realtime', icon: Radio },
  { to: '/sites', label: 'Sites', icon: Globe },
  { divider: true },
  { to: '/sources', label: 'Sources', icon: Filter },
  { to: '/pages', label: 'Pages', icon: BarChart3 },
  { to: '/countries', label: 'Countries', icon: MapPin },
  { to: '/browsers', label: 'Browsers', icon: Monitor },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/events', label: 'Events', icon: Layers },
  { to: '/funnels', label: 'Funnels', icon: Users },
  { to: '/paths', label: 'Paths', icon: GitBranch },
  { divider: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Mini Plausible
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, idx) =>
          item.divider ? (
            <div key={`div-${idx}`} style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 14px' }} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to!}
              className={({ isActive }) => isActive ? 'active' : ''}
              end={item.to === '/dashboard' || item.to === '/sites'}
            >
              {item.icon && <item.icon />}
              {item.label}
            </NavLink>
          )
        )}
      </nav>
      <div className="sidebar-footer">
        <NavLink
          to="/dashboard"
          style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', opacity: 0.6 }}
        >
          Mini Plausible v1.0
        </NavLink>
      </div>
    </aside>
  );
}

