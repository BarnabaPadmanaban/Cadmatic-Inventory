import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ems_auth_token';
const USER_KEY = 'ems_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  // Bootstrap session from storage on first load
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);

    const bootstrap = async () => {
      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          try { setUser(JSON.parse(storedUser)); } catch { setUser(null); }
        }

        try {
          const res = await authAPI.getMe();
          setUser(res.data.data);
          const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
          storage.setItem(USER_KEY, JSON.stringify(res.data.data));
        } catch {
          clearSession();
        }
      }
      setLoading(false);
    };

    bootstrap();
  }, []);

  const login = useCallback(async (username, password, rememberMe) => {
    const res = await authAPI.login({ username, password });
    const { token: newToken, user: newUser } = res.data;

    const store = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;
    store.setItem(TOKEN_KEY, newToken);
    store.setItem(USER_KEY, JSON.stringify(newUser));
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);

    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* best-effort server log */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'Admin';
  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const getStoredToken = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export { TOKEN_KEY, USER_KEY };
