import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api/client';
import { SiteProvider } from './hooks/useSite';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Realtime from './pages/Realtime';
import Sources from './pages/Sources';
import Pages from './pages/Pages';
import Countries from './pages/Countries';
import Browsers from './pages/Browsers';
import Devices from './pages/Devices';
import Events from './pages/Events';
import Funnels from './pages/Funnels';
import Paths from './pages/Paths';
import Settings from './pages/Settings';
import Sites from './pages/Sites';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <SiteProvider>{children}</SiteProvider>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  if (auth.isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/realtime" element={<ProtectedRoute><Realtime /></ProtectedRoute>} />
        <Route path="/sources" element={<ProtectedRoute><Sources /></ProtectedRoute>} />
        <Route path="/pages" element={<ProtectedRoute><Pages /></ProtectedRoute>} />
        <Route path="/countries" element={<ProtectedRoute><Countries /></ProtectedRoute>} />
        <Route path="/browsers" element={<ProtectedRoute><Browsers /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
        <Route path="/funnels" element={<ProtectedRoute><Funnels /></ProtectedRoute>} />
        <Route path="/paths" element={<ProtectedRoute><Paths /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/sites" element={<ProtectedRoute><Sites /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
