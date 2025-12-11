/**
 * defineEndpoint - Define custom API endpoints
 *
 * Usage:
 *   const SearchEndpoint = defineEndpoint('/api/search', {
 *     method: 'GET',
 *     params: {
 *       q: field.string().required(),
 *       limit: field.number.int().default(20),
 *     },
 *     response: {
 *       results: field.array(field.ref('post')),
 *       total: field.number.int(),
 *     },
 *     mockResolver: (db, params) => ({
 *       results: db.post.findMany({ where: { title: { contains: params.q } } }),
 *       total: 100,
 *     }),
 *   });
 */

import { EndpointSchema, FieldDefinition } from './types';

export interface DefineEndpointConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  request?: Record<string, any>;
  response: Record<string, any>;
  mockResolver?: (db: any, params: any, context: any) => any;
}

/**
 * Define a custom API endpoint not tied to standard CRUD operations.
 *
 * @param path - API path (e.g., '/api/search', '/api/auth/login')
 * @param config - Endpoint configuration
 */
export function defineEndpoint(
  path: string,
  config: DefineEndpointConfig
): EndpointSchema & { __endpoint: string } {
  const schema: EndpointSchema = {
    path,
    method: config.method ?? 'GET',
    params: config.params ? processFields(config.params) : undefined,
    request: config.request ? processFields(config.request) : undefined,
    response: processFields(config.response),
    mockResolver: config.mockResolver,
  };

  return Object.assign(schema, {
    __endpoint: path,
  });
}

function processFields(fields: Record<string, any>): Record<string, FieldDefinition> {
  const result: Record<string, FieldDefinition> = {};

  for (const [key, value] of Object.entries(fields)) {
    result[key] = extractFieldDefinition(value);
  }

  return result;
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
