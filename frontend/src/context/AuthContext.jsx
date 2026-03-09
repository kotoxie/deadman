import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authLogin, authLogout, authCheck } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await authCheck();
      setAuthenticated(res.data.authenticated);
      setPasswordChangeRequired(res.data.passwordChangeRequired || false);
    } catch {
      setAuthenticated(false);
      setPasswordChangeRequired(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const handler = () => { setAuthenticated(false); setPasswordChangeRequired(false); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [check]);

  const login = async (password) => {
    const res = await authLogin(password);
    if (res.data.success) {
      setAuthenticated(true);
      // Re-check to get passwordChangeRequired flag
      await check();
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authLogout();
    setAuthenticated(false);
    setPasswordChangeRequired(false);
  };

  const clearPasswordChangeRequired = () => {
    setPasswordChangeRequired(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, passwordChangeRequired, loading, login, logout, clearPasswordChangeRequired }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
