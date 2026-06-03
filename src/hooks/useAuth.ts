import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'superadmin' | 'admin' | 'content_manager' | 'comercial';

export type UserProfile = {
  tenantId: string;
  role: UserRole;
  fullName: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isUserRole = (value: unknown): value is UserRole =>
  value === 'superadmin' ||
  value === 'admin' ||
  value === 'content_manager' ||
  value === 'comercial';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const profileCacheRef = useRef(new Map<string, UserProfile | null>());
  const inFlightProfileRef = useRef(new Map<string, Promise<UserProfile | null>>());

  useEffect(() => {
    mountedRef.current = true;

    const loadProfile = async (userId: string) => {
      const cached = profileCacheRef.current.get(userId);
      if (cached !== undefined) {
        return cached;
      }

      const existingPromise = inFlightProfileRef.current.get(userId);
      if (existingPromise) {
        return existingPromise;
      }

      const request = (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('tenant_id, role, full_name')
            .eq('id', userId)
            .single();

          if (error || !data || !isUserRole(data.role)) {
            profileCacheRef.current.set(userId, null);
            return null;
          }

          const nextProfile = {
            tenantId: data.tenant_id,
            role: data.role,
            fullName: data.full_name ?? null,
          } satisfies UserProfile;

          profileCacheRef.current.set(userId, nextProfile);
          return nextProfile;
        } finally {
          inFlightProfileRef.current.delete(userId);
        }
      })();

      inFlightProfileRef.current.set(userId, request);
      return request;
    };

    const applySession = async (nextUser: User | null) => {
      if (!mountedRef.current) return;

      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const nextProfile = await loadProfile(nextUser.id);
      if (!mountedRef.current) return;
      setProfile(nextProfile);
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user ?? null);
    });

    return () => {
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, profile, user]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
