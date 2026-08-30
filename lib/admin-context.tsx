'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getAdminClient, getAdminSession, getAdminUser } from './admin-auth';

interface AdminContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const client = getAdminClient();
        if (!client) {
          setLoading(false);
          return;
        }

        // Get current session
        const { session: currentSession } = await getAdminSession();
        setSession(currentSession);

        if (currentSession) {
          const { user: currentUser } = await getAdminUser();
          setUser(currentUser);
        }

        // Listen for auth changes
        const {
          data: { subscription },
        } = client.auth.onAuthStateChange(async (event, newSession) => {
          setSession(newSession);
          if (newSession) {
            const { user: newUser } = await getAdminUser();
            setUser(newUser);
          } else {
            setUser(null);
          }
        });

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Auth initialization failed'));
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signOut = async () => {
    try {
      const client = getAdminClient();
      if (client) {
        await client.auth.signOut();
      }
      setUser(null);
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Sign out failed'));
    }
  };

  return (
    <AdminContext.Provider value={{ user, session, loading, error, signOut }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within AdminProvider');
  }
  return context;
}
