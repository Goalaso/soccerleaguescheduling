import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/auth/me')
      .then((data) => setUser(data.user))
      .catch((err) => {
        setUser(null);
        // A 401 genuinely means "not logged in" — anything else (network
        // blip, server briefly down) shouldn't be silently indistinguishable
        // from that in the logs, even though the visible effect is the same
        // (there's no prior session to fall back to on first load either way).
        if (err.status !== 401) {
          console.error('Failed to check auth session', err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Every cached query (teams, matches, seasons, players, ...) is scoped to
  // whoever's logged in — wipe it all on any identity change so a relogin
  // (as the same or a different user) never shows stale/wrong data.
  const login = async (email, password) => {
    const data = await apiPost('/auth/login', { email, password });
    setUser(data.user);
    queryClient.clear();
    return data.user;
  };

  const devLoginAsAdmin = async () => {
    const data = await apiPost('/auth/dev-login-admin');
    setUser(data.user);
    queryClient.clear();
    return data.user;
  };

  const register = async (profile) => {
    const data = await apiPost('/auth/register', profile);
    setUser(data.user);
    queryClient.clear();
    return data.user;
  };

  const logout = async () => {
    await apiPost('/auth/logout');
    setUser(null);
    queryClient.clear();
  };

  const updateAccount = async (payload) => {
    const data = await apiPatch('/auth/me', payload);
    setUser(data.user);
    return data.user;
  };

  // Not a credential change, unlike updateAccount above — updates local
  // state directly instead of round-tripping through /auth/me for a fresh
  // user object.
  const updatePreferences = async (payload) => {
    const data = await apiPatch('/auth/me/preferences', payload);
    setUser((prev) => ({ ...prev, emailNotificationsEnabled: data.emailNotificationsEnabled }));
    return data;
  };

  // Cookie is already cleared server-side by the deleteMe endpoint — no
  // separate logout call needed, just drop local state the same way logout does.
  const deleteAccount = async (currentPassword) => {
    await apiDelete('/auth/me', { currentPassword });
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateAccount,
        updatePreferences,
        deleteAccount,
        devLoginAsAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
