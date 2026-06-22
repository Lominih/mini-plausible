import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  headerExtra?: ReactNode;
}

export default function Layout({ children, title, headerExtra }: LayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header title={title}>
          {headerExtra}
        </Header>
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}
