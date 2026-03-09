import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authLogin, authLogout, authCheck } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await authCheck();
      setAuthenticated(res.data.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const handler = () => setAuthenticated(false);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [check]);

  const login = async (password) => {
    const res = await authLogin(password);
    if (res.data.success) {
      setAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authLogout();
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
