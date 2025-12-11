/**
 * defineData - Main function for defining data entities
 *
 * Usage:
 *   const User = defineData('user', {
 *     id: field.uuid(),
 *     name: field.person.fullName(),
 *     email: field.internet.email(),
 *     posts: hasMany('post'),
 *     postCount: field.computed({ mock: () => 0, resolve: (u, db) => db.count() }),
 *   }, {
 *     api: { basePath: '/api/users' },
 *   });
 */

import { EntitySchema, FieldDefinition, RelationDefinition, ComputedDefinition, ApiConfig } from './types';
import { registry } from '../runtime/resolver/registry';

export interface DefineDataOptions {
  api?: ApiConfig;
}

type SchemaFields = Record<string, any>;

/**
 * Define a data entity with fields, relations, and computed properties.
 *
 * @param name - Unique name for the entity (e.g., 'user', 'post')
 * @param fields - Object containing field definitions
 * @param options - Additional configuration (API paths, etc.)
 */
export function defineData<T extends SchemaFields>(
  name: string,
  fields: T,
  options: DefineDataOptions = {}
): EntitySchema & { __entity: string; __endpoint: string } {
  const schema: EntitySchema = {
    name,
    primaryKey: 'id',
    fields: {},
    relations: {},
    computed: {},
    api: {
      basePath: options.api?.basePath ?? `/api/${name}s`,
      ...options.api,
    },
  };

  // Process each field
  for (const [key, value] of Object.entries(fields)) {
    if (isRelationDefinition(value)) {
      schema.relations[key] = value;
    } else if (isComputedDefinition(value)) {
      schema.computed[key] = value;
    } else {
      // Regular field - extract definition from builder or use directly
      const fieldDef = extractFieldDefinition(value);
      schema.fields[key] = fieldDef;
    }
  }

  // Register schema
  registry.registerEntity(schema);

  // Return schema with convenience properties for production transform
  return Object.assign(schema, {
    __entity: name,
    __endpoint: schema.api?.basePath ?? `/api/${name}s`,
  });
}

function isRelationDefinition(value: any): value is RelationDefinition {
  return value && ['hasOne', 'hasMany', 'belongsTo'].includes(value.type);
}

function isComputedDefinition(value: any): value is ComputedDefinition {
  return value && typeof value.mock === 'function' && typeof value.resolve === 'function';
}

function extractFieldDefinition(value: any): FieldDefinition {
  // If it's a builder with a build method
  if (value && typeof value.build === 'function') {
    return value.build();
  }

  // If it's a builder with toJSON
  if (value && typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  // If it's already a FieldDefinition
  if (value && typeof value.type === 'string') {
    return value;
  }

  // Default to string type
  return { type: 'string' };
}
