import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { PoolDetailPage } from './pages/PoolDetailPage';
import { PoolsPage } from './pages/PoolsPage';
import { VerifyPage } from './pages/VerifyPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  const location = useLocation();
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* SaaS simulator: uses an API key, not the admin session. */}
      <Route element={<Layout />}>
        <Route path="/verify" element={<VerifyPage />} />
      </Route>
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/pools" element={<PoolsPage />} />
        <Route path="/pools/:poolId" element={<PoolDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/pools" replace />} />
    </Routes>
  );
}
