import { useState, useEffect } from 'react';
import { authService, type AuthUser } from './authService';

export type User = AuthUser;

export const USER_UPDATED_EVENT = 'diagrid_user_updated';

export interface AuthSessionState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

/**
 * React hook that provides current session, loading state, and role checks.
 */
export const useAuthSession = (): AuthSessionState => {
  const [user, setUser] = useState<User | null>(() => authService.getUserSync());
  const [loading, setLoading] = useState<boolean>(() => authService.getUserSync() === null);

  useEffect(() => {
    let mounted = true;
    authService.getUser().then((u) => {
      if (mounted) {
        setUser(u);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    const unsubscribe = authService.onAuthStateChange((updatedUser) => {
      if (mounted) {
        setUser(updatedUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };
};

/**
 * React hook that subscribes to live authentication and profile changes.
 */
export const useCurrentUser = (): User | null => {
  const { user } = useAuthSession();
  return user;
};

/**
 * Backward-compatible mockAuth interface delegating directly to unified authService.
 */
export const mockAuth = {
  getUser: (): User | null => {
    return authService.getUserSync();
  },

  updateUser: (updates: Partial<User>): User => {
    authService.updateProfile(updates).catch(() => {});
    return { ...(authService.getUserSync() || { id: 'usr-default', email: 'user@diagrid.dev', role: 'user' }), ...updates };
  },

  login: (email: string): User => {
    authService.signIn(email).catch(() => {});
    return authService.getUserSync() || { id: 'usr-default', email, role: email.includes('admin') ? 'admin' : 'user' };
  },

  logout: (): void => {
    authService.signOut().catch(() => {});
  },

  isAuthenticated: (): boolean => {
    return authService.getUserSync() !== null;
  },

  isAdmin: (): boolean => {
    const user = authService.getUserSync();
    return user?.role === 'admin';
  }
};
