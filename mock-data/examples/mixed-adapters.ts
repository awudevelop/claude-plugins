/**
 * Mixed Adapters Example
 *
 * This example shows how to use different adapters for different entities.
 * For example:
 * - User data from Supabase
 * - Analytics from REST API
 * - Notifications from Firebase
 */

import { createClient } from '@supabase/supabase-js';
import { configureDataLayer } from '../src/config';
import { createFetchAdapter } from '../src/adapters/fetch';
import { createSupabaseAdapter } from '../src/adapters/supabase';
import { createAuthMiddleware } from '../src/middleware/auth';
import { createRetryMiddleware } from '../src/middleware/retry';

// ============================================================================
// CLIENTS SETUP
// ============================================================================

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// REST API client (for analytics)
const analyticsBaseUrl = process.env.ANALYTICS_API_URL!;
const analyticsApiKey = process.env.ANALYTICS_API_KEY!;

// ============================================================================
// ADAPTERS
// ============================================================================

// Supabase adapter for user-related entities
const supabaseAdapter = createSupabaseAdapter({
  client: supabase,
  tableMap: {
    'user': 'users',
    'userProfile': 'user_profiles',
    'post': 'posts',
  },
});

// Fetch adapter for analytics API
const analyticsAdapter = createFetchAdapter({
  baseUrl: analyticsBaseUrl,
  defaultHeaders: {
    'Content-Type': 'application/json',
    'X-API-Key': analyticsApiKey,
  },
});

// Fetch adapter for notifications (different API)
const notificationsAdapter = createFetchAdapter({
  baseUrl: process.env.NOTIFICATIONS_API_URL!,
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// CONFIGURE DATA LAYER WITH MIXED ADAPTERS
// ============================================================================

configureDataLayer({
  // Default adapter (Supabase)
  adapter: supabaseAdapter,

  // Per-entity adapter overrides
  adapters: {
    // User-related entities use Supabase
    'user': supabaseAdapter,
    'userProfile': supabaseAdapter,
    'post': supabaseAdapter,

    // Analytics uses REST API
    'analytics': analyticsAdapter,
    'pageView': analyticsAdapter,
    'event': analyticsAdapter,

    // Notifications uses different REST API
    'notification': notificationsAdapter,
  },

  // Global middleware
  middleware: [
    createAuthMiddleware({
      getToken: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
      },
    }),
    createRetryMiddleware({ maxRetries: 2 }),
  ],

  // Entity-specific middleware
  entityMiddleware: {
    // Analytics has longer retry
    'analytics': [
      createRetryMiddleware({ maxRetries: 5 }),
    ],

    // Notifications has its own auth
    'notification': [
      createAuthMiddleware({
        getToken: async () => {
          // Different token for notifications service
          return localStorage.getItem('notifications_token');
        },
        headerName: 'X-Notification-Token',
        headerFormat: (token) => token, // No "Bearer" prefix
      }),
    ],
  },
});

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/*
// User (Supabase)
const User = defineData('user', {
  id: field.uuid(),
  name: field.string(),
  email: field.internet.email(),
});

// Analytics Event (REST API)
const AnalyticsEvent = defineData('event', {
  id: field.uuid(),
  type: field.string(),
  data: field.object({}),
  timestamp: field.date(),
}, {
  api: { basePath: '/events' },
});

// Notification (Different REST API)
const Notification = defineData('notification', {
  id: field.uuid(),
  userId: field.uuid(),
  message: field.string(),
  read: field.boolean(),
  createdAt: field.date(),
}, {
  api: { basePath: '/notifications' },
});
*/

// ============================================================================
// USAGE
// ============================================================================

/*
// All of these use different backends transparently:

// Fetches from Supabase
const { data: users } = useData(User);

// Fetches from Analytics API
const { data: events } = useData(AnalyticsEvent, {
  where: { type: 'page_view' },
});

// Fetches from Notifications API
const { data: notifications } = useData(Notification, {
  where: { read: false },
});
*/

export { supabase, analyticsAdapter, notificationsAdapter };
