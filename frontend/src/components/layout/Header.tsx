import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../api/client';

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export default function Header({ title, children }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const user = localStorage.getItem('userEmail') || 'user';

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    auth.logout();
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-left">
        {title && <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{title}</h2>}
        {children}
      </div>
      <div className="header-right">
        <div className="user-menu" ref={ref}>
          <button className="user-menu-trigger" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="user-avatar">{user.charAt(0).toUpperCase()}</div>
            <span style={{ fontSize: '0.87rem', fontWeight: 500 }}>{user}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {menuOpen && (
            <div className="user-menu-dropdown">
              <a href="/settings">Settings</a>
              <button onClick={handleLogout} style={{ color: 'var(--color-danger)' }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
