import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AdminDto } from '@lms/shared';
import { configureApiClient } from '../api/client';
import { lmsApi } from '../api/lms';

interface Session {
  token: string;
  admin: AdminDto;
  expiresAt: number;
}

interface AuthState {
  admin: AdminDto | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session is held in React memory only — never localStorage — so an XSS payload can't read
 * a persisted token. Trade-off (agreed for v1): a full page reload requires logging in again.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    setSession(null);
    queryClient.clear(); // drop cached tenant data
  }, [queryClient]);

  configureApiClient({
    getToken: () => {
      const s = sessionRef.current;
      return s && s.expiresAt > Date.now() ? s.token : null;
    },
    onUnauthorized: logout,
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await lmsApi.login(email, password);
    setSession({ token: res.accessToken, admin: res.admin, expiresAt: Date.now() + res.expiresIn * 1000 });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      admin: session?.admin ?? null,
      isAdmin: session?.admin.role === 'ORG_ADMIN',
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
