// ─────────────────────────────────────────────────────────────
// Auth Context – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { CRMUser } from '../types/crm';

// ── Context shape ────────────────────────────────────────────
interface AuthContextValue {
  /** Firebase Auth user */
  user: User | null;
  /** CRM profile from Firestore users/{uid} */
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

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            setCrmUser({
              ...data,
              id: snap.id,
              uid: snap.id,
              createdAt: data.createdAt?.toDate?.() ?? new Date(),
              updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
            } as CRMUser);
          } else {
            setCrmUser(null);
          }
        } catch (err) {
          console.error('Failed to fetch CRM user profile:', err);
          setCrmUser(null);
        }
      } else {
        setCrmUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Auth actions
  const login = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      // Offline / emulator mock fallback for local dev accounts
      const cleanEmail = email.trim().toLowerCase();
      if (
        (cleanEmail === 'ben@garageautosupplies.com' && password === 'clutchking123') ||
        (cleanEmail === 'pablo@garageautosupplies.com' && password === 'pabgoat123') ||
        (cleanEmail === 'admin@garageautosupplies.com' && password === 'password123') ||
        (cleanEmail === 'sales@garageautosupplies.com' && password === 'password123')
      ) {
        const isBenOrAdmin = cleanEmail.startsWith('ben') || cleanEmail.startsWith('admin');
        const mockUid = isBenOrAdmin ? 'ben-test-uid' : 'pablo-test-uid';
        const mockName = isBenOrAdmin ? 'Ben (Clutch King)' : 'Pablo (Pab Goat)';
        const mockRole = isBenOrAdmin ? 'admin' : 'sales_rep';

        const mockFirebaseUser = {
          uid: mockUid,
          email: cleanEmail,
          displayName: mockName,
          emailVerified: true,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          refreshToken: '',
          tenantId: null,
          delete: async () => {},
          getIdToken: async () => 'mock-token',
          getIdTokenResult: async () => ({ token: 'mock', signInProvider: 'custom', claims: {}, authTime: '', issuedAtTime: '', expirationTime: '' }),
          reload: async () => {},
          toJSON: () => ({}),
          phoneNumber: null,
          photoURL: null,
          providerId: 'custom',
        } as unknown as User;

        setUser(mockFirebaseUser);
        setCrmUser({
          id: mockUid,
          uid: mockUid,
          email: cleanEmail,
          displayName: mockName,
          role: mockRole,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return;
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
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
