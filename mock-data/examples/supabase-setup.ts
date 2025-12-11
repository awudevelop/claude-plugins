/**
 * Supabase Setup Example
 *
 * This example shows how to configure MockData with Supabase as the backend.
 */

import { createClient } from '@supabase/supabase-js';
import { configureDataLayer } from '../src/config';
import { createSupabaseAdapter } from '../src/adapters/supabase';
import { createAuthMiddleware } from '../src/middleware/auth';
import { createRetryMiddleware } from '../src/middleware/retry';

// ============================================================================
// SUPABASE CLIENT SETUP
// ============================================================================

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// CONFIGURE DATA LAYER
// ============================================================================

configureDataLayer({
  // Use Supabase adapter as default
  adapter: createSupabaseAdapter({
    client: supabase,

    // Map entity names to Supabase table names
    tableMap: {
      'user': 'users',
      'userProfile': 'user_profiles',
      'post': 'posts',
    },

    // Default select queries with relations
    selectMap: {
      'user': '*, user_profiles(*)',
      'post': '*, users(*)',
    },
  }),

  // Global middleware
  middleware: [
    // Auth middleware - injects Supabase session token
    createAuthMiddleware({
      getToken: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
      },

      refreshToken: async () => {
        const { data: { session } } = await supabase.auth.refreshSession();
        return session?.access_token ?? null;
      },

      onUnauthorized: async () => {
        // Redirect to login
        window.location.href = '/login';
      },
    }),

    // Retry middleware for transient failures
    createRetryMiddleware({
      maxRetries: 3,
      retryOn: (error) => {
        // Retry on network errors or 5xx
        return error.message.includes('network') ||
               (error as any).status >= 500;
      },
    }),
  ],
});

// ============================================================================
// AUTH HELPERS
// ============================================================================

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// In your React component:

import { useData, useMutate } from '@mockdata/react';
import { User, Post } from './schemas';

function Dashboard() {
  // This now fetches from Supabase
  const { data: users } = useData(User, { limit: 10 });

  const { create } = useMutate(Post);

  const handleCreatePost = async () => {
    // This creates in Supabase
    await create.mutateAsync({
      title: 'My New Post',
      body: 'Content here...',
    });
  };

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users?.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
      <button onClick={handleCreatePost}>Create Post</button>
    </div>
  );
}
*/

export { supabase };
