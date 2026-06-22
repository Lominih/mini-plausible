import { useState, useCallback } from 'react';
import { auth } from '../api/client';
import type { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await auth.login({ email, password });
      auth.setTokens(res.accessToken, res.refreshToken);
      localStorage.setItem('userEmail', res.user.email);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await auth.register({ email, password, name });
      auth.setTokens(res.accessToken, res.refreshToken);
      localStorage.setItem('userEmail', res.user.email);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    localStorage.removeItem('userEmail');
    setUser(null);
  }, []);

  return { user, loading, error, login, register, logout, isAuthenticated: auth.isAuthenticated() };
}
