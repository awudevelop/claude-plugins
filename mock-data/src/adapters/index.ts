/**
 * @mockdata/adapters
 *
 * Pluggable backend adapters for MockData.
 */

// Types
export type {
  Adapter,
  AdapterContext,
  AdapterResponse,
  AdapterFactory,
} from './types';

export { AdapterError } from './types';

// Built-in adapters
export { createFetchAdapter, fetchAdapter } from './fetch';
export type { FetchAdapterConfig } from './fetch';

export { createSupabaseAdapter, SupabaseAdapterError } from './supabase';
export type { SupabaseAdapterConfig } from './supabase';

// Note: Firebase and GraphQL adapters would be in separate files
// export { createFirebaseAdapter } from './firebase';
// export { createGraphQLAdapter } from './graphql';
