import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Staff, UserRole } from '@/types';
import { INITIAL_STAFF } from '@/lib/mockData';
import { monitoring } from '@/lib/monitoring';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  staff: Staff | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  switchRole: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      setSession(data?.session ?? null);
      setUser(data?.session?.user ?? null);
      if (data?.session?.user) {
        loadStaff(data.session.user.id, data.session.user.email);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, newSession: any) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadStaff(newSession.user.id, newSession.user.email);
      } else {
        setStaff(null);
        setLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (staff) {
      monitoring.setUser({ id: staff.id, name: staff.full_name, email: staff.email, role: staff.role });
    } else {
      monitoring.setUser(null);
    }
  }, [staff]);

  async function loadStaff(userId: string, email?: string) {
    try {
      const { data } = await supabase
        .from('erp_staff')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setStaff(data as Staff);
      } else if (email) {
        const { data: staffByEmail } = await supabase
          .from('erp_staff')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (staffByEmail) {
          setStaff(staffByEmail as Staff);
        } else {
          // Fallback to default admin staff
          setStaff(INITIAL_STAFF[0]);
        }
      } else {
        setStaff(INITIAL_STAFF[0]);
      }
    } catch {
      setStaff(INITIAL_STAFF[0]);
    } finally {
      setLoading(false);
    }
  }

  async function switchRole(role: UserRole) {
    const { data } = await supabase.from('erp_staff').select('*').eq('role', role).maybeSingle();
    const targetStaff = data || INITIAL_STAFF.find(s => s.role === role) || INITIAL_STAFF[0];
    setStaff(targetStaff as Staff);

    const updatedSession = {
      access_token: 'demo-token-' + targetStaff.id,
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: targetStaff.user_id || `user-${targetStaff.id}`,
        email: targetStaff.email,
        user_metadata: { full_name: targetStaff.full_name, role: targetStaff.role },
      },
    };
    localStorage.setItem('arboss_auth_session', JSON.stringify(updatedSession));
    setSession(updatedSession as any);
    setUser(updatedSession.user as any);
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data?.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await loadStaff(data.session.user.id, data.session.user.email);
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setStaff(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, staff, loading, signIn, switchRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
