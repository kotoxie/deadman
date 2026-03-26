import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authLogin, authLogout, authCheck, setCsrfToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const csrfRef = useRef(null);

  const check = useCallback(async () => {
    try {
      const res = await authCheck();
      setAuthenticated(res.data.authenticated);
      setPasswordChangeRequired(res.data.passwordChangeRequired || false);
      setSetupRequired(res.data.setupRequired || false);
      if (res.data.csrfToken) {
        csrfRef.current = res.data.csrfToken;
        setCsrfToken(res.data.csrfToken);
      }
    } catch {
      setAuthenticated(false);
      setPasswordChangeRequired(false);
      setSetupRequired(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const handler = () => { setAuthenticated(false); setPasswordChangeRequired(false); setSetupRequired(false); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [check]);

  const login = async (password) => {
    const res = await authLogin(password);
    if (res.data.success) {
      setAuthenticated(true);
      await check();
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authLogout();
    setAuthenticated(false);
    setPasswordChangeRequired(false);
    setSetupRequired(false);
  };

  const clearPasswordChangeRequired = () => {
    setPasswordChangeRequired(false);
  };

  const completeSetup = (csrfToken) => {
    setCsrfToken(csrfToken);
    setSetupRequired(false);
    setAuthenticated(true);
    setPasswordChangeRequired(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, passwordChangeRequired, setupRequired, loading, login, logout, clearPasswordChangeRequired, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
