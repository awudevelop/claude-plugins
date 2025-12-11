/**
 * Fetch Adapter
 *
 * Default adapter using the Fetch API for REST endpoints.
 */

import { Adapter, AdapterContext, AdapterResponse, AdapterFactory, AdapterError } from './types';

export interface FetchAdapterConfig {
  /** Base URL for API requests */
  baseUrl?: string;

  /** Default headers to include in all requests */
  defaultHeaders?: Record<string, string>;

  /** Credentials mode for fetch */
  credentials?: RequestCredentials;

  /** Custom fetch implementation (for SSR or testing) */
  fetch?: typeof fetch;

  /** Response transformer */
  transformResponse?: (response: any) => any;
}

/**
 * Create a Fetch adapter
 *
 * @example
 * const adapter = createFetchAdapter({
 *   baseUrl: 'https://api.example.com',
 *   defaultHeaders: { 'X-API-Key': 'secret' },
 * });
 */
export const createFetchAdapter: AdapterFactory<FetchAdapterConfig> = (config = {}) => {
  const {
    baseUrl = '',
    defaultHeaders = { 'Content-Type': 'application/json' },
    credentials = 'same-origin',
    fetch: customFetch = globalThis.fetch,
    transformResponse = (data) => data,
  } = config;

  async function request<T>(
    method: string,
    path: string,
    ctx: AdapterContext
  ): Promise<AdapterResponse<T>> {
    // Build URL
    const url = new URL(path, baseUrl || undefined);

    // Add query params for GET requests
    if (ctx.params && method === 'GET') {
      for (const [key, value] of Object.entries(ctx.params)) {
        if (value !== undefined && key !== 'id') {
          if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(','));
          } else if (typeof value === 'object') {
            url.searchParams.set(key, JSON.stringify(value));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    // Make request
    const response = await customFetch(url.toString(), {
      method,
      headers: { ...defaultHeaders, ...ctx.headers },
      credentials,
      signal: ctx.signal,
      body: ctx.data ? JSON.stringify(ctx.data) : undefined,
    });

    // Handle errors
    if (!response.ok) {
      const body = await response.text();
      throw new AdapterError(response.status, body, ctx);
    }

    // Parse response
    const data = response.status === 204 ? null : await response.json();

    return {
      data: transformResponse(data),
      meta: {
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  }

  return {
    name: 'fetch',

    findOne: (ctx) =>
      request('GET', `${ctx.endpoint}/${ctx.params?.id}`, ctx),

    findMany: (ctx) =>
      request('GET', ctx.endpoint!, ctx),

    create: (ctx) =>
      request('POST', ctx.endpoint!, ctx),

    update: (ctx) =>
      request('PUT', `${ctx.endpoint}/${ctx.params?.id}`, ctx),

    delete: (ctx) =>
      request('DELETE', `${ctx.endpoint}/${ctx.params?.id}`, ctx),

    custom: (ctx) =>
      request(ctx.params?.method ?? 'GET', ctx.endpoint!, ctx),
  };
};

/**
 * Default fetch adapter instance
 */
export const fetchAdapter = createFetchAdapter();
