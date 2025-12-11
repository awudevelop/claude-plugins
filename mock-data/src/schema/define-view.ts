/**
 * defineView - Define custom views/aggregations
 *
 * Usage:
 *   const UserFullView = defineView('user-full', {
 *     ...pick(User, ['id', 'name', 'email']),
 *     profile: embed(UserProfile),
 *     recentPosts: embed(Post, { limit: 5 }),
 *     stats: {
 *       postCount: field.computed({ ... }),
 *     },
 *   }, {
 *     endpoint: '/api/users/:id/full',
 *     params: ['id'],
 *   });
 */

import { ViewSchema, FieldDefinition, EmbedDefinition, EntitySchema, ComputedDefinition } from './types';
import { registry } from '../runtime/resolver/registry';

export interface DefineViewOptions {
  endpoint: string;
  params?: string[];
  mockResolver?: (db: any, params: any, context: any) => any;
}

type ViewFields = Record<string, any>;

/**
 * Define a view that aggregates data from one or more entities.
 *
 * @param name - Unique name for the view
 * @param fields - Object containing field/embed definitions
 * @param options - Endpoint and resolver configuration
 */
export function defineView<T extends ViewFields>(
  name: string,
  fields: T,
  options: DefineViewOptions
): ViewSchema & { __view: string; __endpoint: string } {
  const schema: ViewSchema = {
    name,
    fields: {},
    computed: {},
    endpoint: options.endpoint,
    params: options.params ?? extractParamsFromEndpoint(options.endpoint),
    mockResolver: options.mockResolver,
  };

  // Process fields
  for (const [key, value] of Object.entries(fields)) {
    if (isEmbedDefinition(value)) {
      schema.fields[key] = value;
    } else if (isComputedDefinition(value)) {
      schema.computed[key] = value;
    } else if (isNestedObject(value)) {
      // Nested object with computed fields
      schema.fields[key] = processNestedObject(value);
    } else {
      schema.fields[key] = extractFieldDefinition(value);
    }
  }

  // Register view
  registry.registerView(schema);

  return Object.assign(schema, {
    __view: name,
    __endpoint: options.endpoint,
  });
}

/**
 * Embed a related entity in a view.
 *
 * @param entity - Entity schema to embed
 * @param options - Embedding options (limit, orderBy, etc.)
 */
export function embed(
  entity: EntitySchema | string,
  options: {
    limit?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    where?: Record<string, any>;
    relation?: string;
  } = {}
): EmbedDefinition {
  const target = typeof entity === 'string' ? entity : entity.name;

  return {
    type: 'embed',
    target,
    limit: options.limit,
    orderBy: options.orderBy,
    where: options.where,
    relation: options.relation,
  };
}

/**
 * Pick specific fields from an entity schema.
 *
 * @param entity - Entity schema to pick from
 * @param fieldNames - Array of field names to include
 */
export function pick(
  entity: EntitySchema,
  fieldNames: string[]
): Record<string, FieldDefinition> {
  const result: Record<string, FieldDefinition> = {};

  for (const name of fieldNames) {
    if (entity.fields[name]) {
      result[name] = entity.fields[name];
    }
  }

  return result;
}

// Helper functions

function extractParamsFromEndpoint(endpoint: string): string[] {
  const matches = endpoint.match(/:(\w+)/g);
  return matches ? matches.map(m => m.slice(1)) : [];
}

function isEmbedDefinition(value: any): value is EmbedDefinition {
  return value && value.type === 'embed';
}

function isComputedDefinition(value: any): value is ComputedDefinition {
  return value && typeof value.mock === 'function' && typeof value.resolve === 'function';
}

function isNestedObject(value: any): boolean {
  return value && typeof value === 'object' && !value.type && !value.mock;
}

function extractFieldDefinition(value: any): FieldDefinition {
  if (value && typeof value.build === 'function') {
    return value.build();
  }
  if (value && typeof value.toJSON === 'function') {
    return value.toJSON();
  }
  if (value && typeof value.type === 'string') {
    return value;
  }
  return { type: 'string' };
}

function processNestedObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isComputedDefinition(value)) {
      result[key] = value;
    } else {
      result[key] = extractFieldDefinition(value);
    }
  }

  return result;
}
