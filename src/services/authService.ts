import { supabase, isSupabaseConfigured } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  name?: string;
  avatar?: string;
  avatarType?: 'preset' | 'custom' | 'initials';
  presetAvatar?: string;
  bio?: string;
  theme?: 'blueprint' | 'dark' | 'light';
  defaultNotation?: 'erd' | 'flowchart' | 'sequence';
}

const ADMIN_EMAIL = 'admin@diagrid.dev';
const STORAGE_KEY = 'diagrid_auth_user';

const getStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setCachedUser = (user: AuthUser | null) => {
  cachedUser = user;
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
};

// In-memory cache for synchronous render operations initialized from storage
let cachedUser: AuthUser | null = getStoredUser();
let isInitialized = false;
let pendingProfilePromise: Promise<AuthUser> | null = null;
let profileFetchFailed = false;

/**
 * Fetches user profile from public.profiles table or builds fallback from session metadata.
 */
const fetchProfile = async (userId: string, email: string): Promise<AuthUser> => {
  const normalizedEmail = email.toLowerCase().trim();
  const isAdminEmail = normalizedEmail === ADMIN_EMAIL || normalizedEmail.includes('admin');

  if (cachedUser && cachedUser.id === userId && profileFetchFailed) {
    return cachedUser;
  }

  if (pendingProfilePromise) {
    return pendingProfilePromise;
  }

  pendingProfilePromise = (async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        profileFetchFailed = true;
        const role: 'user' | 'admin' = isAdminEmail ? 'admin' : 'user';
        const fallbackUser: AuthUser = {
          id: userId,
          email,
          role,
          name: email.split('@')[0],
          avatarType: 'preset',
          presetAvatar: role === 'admin' ? 'shield' : 'terminal',
          theme: 'blueprint',
          defaultNotation: 'erd',
        };
        setCachedUser(fallbackUser);
        return fallbackUser;
      }

      profileFetchFailed = false;
      const resolvedRole: 'user' | 'admin' = (profile.role === 'admin' || isAdminEmail) ? 'admin' : 'user';

      const resolvedUser: AuthUser = {
        id: profile.id,
        email: profile.email || email,
        role: resolvedRole,
        name: profile.name || email.split('@')[0],
        avatar: profile.avatar_url,
        avatarType: profile.avatar_type || 'preset',
        presetAvatar: resolvedRole === 'admin' && (!profile.preset_avatar || profile.preset_avatar === 'terminal') ? 'shield' : (profile.preset_avatar || 'terminal'),
        bio: profile.bio,
        theme: profile.theme || 'blueprint',
        defaultNotation: profile.default_notation || 'erd',
      };

      setCachedUser(resolvedUser);
      return resolvedUser;
    } catch {
      profileFetchFailed = true;
      const role: 'user' | 'admin' = isAdminEmail ? 'admin' : 'user';
      const fallbackUser: AuthUser = {
        id: userId,
        email,
        role,
        name: email.split('@')[0],
        avatarType: 'preset',
        presetAvatar: role === 'admin' ? 'shield' : 'terminal',
        theme: 'blueprint',
        defaultNotation: 'erd',
      };
      setCachedUser(fallbackUser);
      return fallbackUser;
    } finally {
      pendingProfilePromise = null;
    }
  })();

  return pendingProfilePromise;
};

export const authService = {
  isConfigured: (): boolean => isSupabaseConfigured(),

  getUserSync: (): AuthUser | null => {
    return cachedUser;
  },

  getUser: async (): Promise<AuthUser | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        setCachedUser(null);
        return null;
      }
      const user = await fetchProfile(session.user.id, session.user.email || '');
      setCachedUser(user);
      return user;
    } catch {
      setCachedUser(null);
      return null;
    }
  },

  signIn: async (email: string, password?: string): Promise<{ user: AuthUser | null; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return {
        user: null,
        error: 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
      };
    }

    if (!password) {
      return { user: null, error: 'Password is required' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'Sign in failed' };
    }

    const user = await fetchProfile(data.user.id, data.user.email || email);
    setCachedUser(user);
    return { user };
  },

  signUp: async (email: string, password: string, name?: string): Promise<{ user: AuthUser | null; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return {
        user: null,
        error: 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
      };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isAdminEmail = normalizedEmail === ADMIN_EMAIL || normalizedEmail.includes('admin');

    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard`
      : 'http://localhost:5173/dashboard';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name?.trim() || email.split('@')[0],
          role: isAdminEmail ? 'admin' : 'user',
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'Registration failed' };
    }

    if (data.session) {
      const user = await fetchProfile(data.user.id, data.user.email || email);
      setCachedUser(user);
      return { user };
    }

    return {
      user: null,
      error: 'Account created! Please check your email inbox to confirm your registration.',
    };
  },

  signInWithOAuth: async (provider: 'google' | 'github'): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
      };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) return { error: error.message };
    return {};
  },

  signOut: async (): Promise<void> => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setCachedUser(null);
  },

  updateProfile: async (updates: Partial<AuthUser>): Promise<{ user: AuthUser | null; error?: string }> => {
    if (!isSupabaseConfigured() || !cachedUser) {
      return {
        user: cachedUser,
        error: 'Supabase is not configured. Please add credentials to .env file.',
      };
    }

    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.theme !== undefined) payload.theme = updates.theme;
    if (updates.defaultNotation !== undefined) payload.default_notation = updates.defaultNotation;
    if (updates.avatarType !== undefined) payload.avatar_type = updates.avatarType;
    if (updates.presetAvatar !== undefined) payload.preset_avatar = updates.presetAvatar;
    if (updates.avatar !== undefined) payload.avatar_url = updates.avatar;

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', cachedUser.id);

    if (error) {
      return { user: cachedUser, error: error.message };
    }

    const updated = { ...cachedUser, ...updates };
    setCachedUser(updated);
    return { user: updated };
  },

  resetPassword: async (email: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) return { error: error.message };
    return {};
  },

  updatePassword: async (password: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: password.trim(),
    });

    if (error) return { error: error.message };
    return {};
  },

  onAuthStateChange: (callback: (user: AuthUser | null) => void): (() => void) => {
    if (!isSupabaseConfigured()) {
      callback(null);
      return () => {};
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = await fetchProfile(session.user.id, session.user.email || '');
        setCachedUser(user);
        callback(user);
      } else {
        setCachedUser(null);
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },
};

// Initialize session state on app load
if (!isInitialized && typeof window !== 'undefined') {
  isInitialized = true;
  authService.getUser().catch(() => {});
}
