/**
 * Supabase Adapter
 *
 * Adapter for Supabase backend using the Supabase client SDK.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Adapter, AdapterContext, AdapterResponse, AdapterFactory } from './types';

export interface SupabaseAdapterConfig {
  /** Supabase client instance */
  client: SupabaseClient;

  /** Map entity names to table names (if different) */
  tableMap?: Record<string, string>;

  /** Map entity names to default select queries (for relations) */
  selectMap?: Record<string, string>;
}

/**
 * Error class for Supabase-specific errors
 */
export class SupabaseAdapterError extends Error {
  constructor(
    public supabaseError: any,
    public context: AdapterContext
  ) {
    super(supabaseError?.message ?? 'Supabase error');
    this.name = 'SupabaseAdapterError';
  }
}

/**
 * Create a Supabase adapter
 *
 * @example
 * const adapter = createSupabaseAdapter({
 *   client: supabase,
 *   tableMap: { userProfile: 'user_profiles' },
 *   selectMap: { user: '*, profile:user_profiles(*)' },
 * });
 */
export const createSupabaseAdapter: AdapterFactory<SupabaseAdapterConfig> = (config) => {
  const { client, tableMap = {}, selectMap = {} } = config;

  /**
   * Get table name for entity
   */
  function getTable(entity: string): string {
    return tableMap[entity] ?? entity;
  }

  /**
   * Build select query
   */
  function getSelect(entity: string, include?: string[]): string {
    if (selectMap[entity]) return selectMap[entity];
    if (!include?.length) return '*';

    // Build select with relations: '*, profile(*), posts(*)'
    return `*, ${include.map(rel => `${rel}(*)`).join(', ')}`;
  }

  /**
   * Apply where filters to query
   */
  function applyFilters(query: any, where?: Record<string, any>): any {
    if (!where) return query;

    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        if ('contains' in value) {
          query = query.ilike(key, `%${value.contains}%`);
        } else if ('equals' in value) {
          query = query.eq(key, value.equals);
        } else if ('gt' in value) {
          query = query.gt(key, value.gt);
        } else if ('gte' in value) {
          query = query.gte(key, value.gte);
        } else if ('lt' in value) {
          query = query.lt(key, value.lt);
        } else if ('lte' in value) {
          query = query.lte(key, value.lte);
        } else if ('in' in value) {
          query = query.in(key, value.in);
        }
      } else {
        query = query.eq(key, value);
      }
    }

    return query;
  }

  return {
    name: 'supabase',

    async findOne(ctx) {
      const table = getTable(ctx.entity);
      const select = getSelect(ctx.entity, ctx.params?.include);

      const { data, error } = await client
        .from(table)
        .select(select)
        .eq('id', ctx.params?.id)
        .single();

      if (error) throw new SupabaseAdapterError(error, ctx);

      return { data };
    },

    async findMany(ctx) {
      const table = getTable(ctx.entity);
      const select = getSelect(ctx.entity, ctx.params?.include);

      let query = client.from(table).select(select, { count: 'exact' });

      // Apply filters
      query = applyFilters(query, ctx.params?.where);

      // Apply pagination
      if (ctx.params?.limit) {
        query = query.limit(ctx.params.limit);
      }
      if (ctx.params?.offset) {
        query = query.range(
          ctx.params.offset,
          ctx.params.offset + (ctx.params.limit ?? 20) - 1
        );
      }

      // Apply ordering
      if (ctx.params?.orderBy) {
        for (const [key, direction] of Object.entries(ctx.params.orderBy)) {
          query = query.order(key, { ascending: direction === 'asc' });
        }
      }

      const { data, error, count } = await query;

      if (error) throw new SupabaseAdapterError(error, ctx);

      return {
        data: data ?? [],
        meta: { total: count ?? 0 },
      };
    },

    async create(ctx) {
      const table = getTable(ctx.entity);

      const { data, error } = await client
        .from(table)
        .insert(ctx.data)
        .select()
        .single();

      if (error) throw new SupabaseAdapterError(error, ctx);

      return { data };
    },

    async update(ctx) {
      const table = getTable(ctx.entity);

      const { data, error } = await client
        .from(table)
        .update(ctx.data)
        .eq('id', ctx.params?.id)
        .select()
        .single();

      if (error) throw new SupabaseAdapterError(error, ctx);

      return { data };
    },

    async delete(ctx) {
      const table = getTable(ctx.entity);

      const { error } = await client
        .from(table)
        .delete()
        .eq('id', ctx.params?.id);

      if (error) throw new SupabaseAdapterError(error, ctx);

      return { data: undefined };
    },

    async custom(ctx) {
      // For RPC calls
      if (ctx.params?.rpc) {
        const { data, error } = await client.rpc(ctx.params.rpc, ctx.params.args);
        if (error) throw new SupabaseAdapterError(error, ctx);
        return { data };
      }

      throw new Error('Custom operation requires rpc param for Supabase adapter');
    },
  };
};
