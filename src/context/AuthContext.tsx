// ─────────────────────────────────────────────────────────────
// Auth Context – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { CRMUser } from '../types/crm';

// ── Context shape ────────────────────────────────────────────
interface AuthContextValue {
  /** Supabase Auth user */
  user: User | null;
  /** CRM profile from PostgreSQL users table */
  crmUser: CRMUser | null;
  /** True while auth state or CRM profile is loading */
  loading: boolean;
  /** Sign in with email / password */
  login: (email: string, password: string) => Promise<void>;
  /** Sign out */
  logout: () => Promise<void>;
  /** Role helpers */
  isAdmin: boolean;
  isSalesRep: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [crmUser, setCrmUser] = useState<CRMUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCrmUser = useCallback(async (supabaseUser: User) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', supabaseUser.id)
        .single();

      if (error || !data) {
        // Fallback profile if row hasn't replicated yet or missing
        setCrmUser({
          id: supabaseUser.id,
          uid: supabaseUser.id,
          email: supabaseUser.email || '',
          displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || 'User',
          role: (supabaseUser.user_metadata?.role as any) || 'sales_rep',
          createdAt: new Date(supabaseUser.created_at || Date.now()),
          updatedAt: new Date(),
        });
      } else {
        setCrmUser({
          id: data.id || data.uid,
          uid: data.uid,
          email: data.email || supabaseUser.email || '',
          displayName: data.display_name || data.email?.split('@')[0] || 'User',
          role: data.role || 'sales_rep',
          avatarUrl: data.avatar_url,
          phone: data.phone,
          createdAt: data.created_at ? new Date(data.created_at) : new Date(),
          updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
        });
      }
    } catch (err) {
      console.error('Failed to fetch CRM user profile:', err);
      setCrmUser(null);
    }
  }, []);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchCrmUser(currentUser).finally(() => setLoading(false));
      } else {
        setCrmUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchCrmUser(currentUser);
      } else {
        setCrmUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchCrmUser]);

  // Auth actions
  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore offline error
    }
    setUser(null);
    setCrmUser(null);
  }, []);

  // Role derivations
  const isAdmin = crmUser?.role === 'admin';
  const isSalesRep = crmUser?.role === 'sales_rep';
  const isViewer = crmUser?.role === 'viewer';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      crmUser,
      loading,
      login,
      logout,
      isAdmin,
      isSalesRep,
      isViewer,
    }),
    [user, crmUser, loading, login, logout, isAdmin, isSalesRep, isViewer]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
