import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return adminClient;
}

export async function adminSignUp(
  email: string,
  password: string
): Promise<{ user: User | null; error: Error | null }> {
  const client = getAdminClient();
  if (!client) {
    return {
      user: null,
      error: new Error('Supabase not configured'),
    };
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  return {
    user: data.user,
    error,
  };
}

export async function adminSignIn(
  email: string,
  password: string
): Promise<{ session: Session | null; error: Error | null }> {
  const client = getAdminClient();
  if (!client) {
    return {
      session: null,
      error: new Error('Supabase not configured'),
    };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  return {
    session: data.session,
    error,
  };
}

export async function adminSignOut(): Promise<{ error: Error | null }> {
  const client = getAdminClient();
  if (!client) {
    return { error: new Error('Supabase not configured') };
  }

  const { error } = await client.auth.signOut();
  return { error };
}

export async function getAdminSession() {
  const client = getAdminClient();
  if (!client) {
    return { session: null, error: null };
  }

  const { data, error } = await client.auth.getSession();
  return { session: data.session, error };
}

export async function getAdminUser() {
  const client = getAdminClient();
  if (!client) {
    return { user: null, error: null };
  }

  const { data, error } = await client.auth.getUser();
  return { user: data.user, error };
}
