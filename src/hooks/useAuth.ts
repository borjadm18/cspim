import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'superadmin' | 'admin' | 'content_manager' | 'comercial';

export type UserProfile = {
  tenantId: string;
  role: UserRole;
  fullName: string | null;
};

const isUserRole = (value: unknown): value is UserRole =>
  value === 'superadmin' ||
  value === 'admin' ||
  value === 'content_manager' ||
  value === 'comercial';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tenant_id, role, full_name')
          .eq('id', userId)
          .single();

        if (!isMounted) return;

        if (error || !data || !isUserRole(data.role)) {
          setProfile(null);
          return;
        }

        setProfile({
          tenantId: data.tenant_id,
          role: data.role,
          fullName: data.full_name ?? null,
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;

      const nextUser = data.session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        setLoading(true);
        void loadProfile(nextUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        setLoading(true);
        void loadProfile(nextUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  return { user, profile, loading, signOut };
}
