/**
 * @mockdata/schema
 *
 * Schema definition DSL for MockData.
 * Define your data entities, fields, relationships, and computed properties.
 */

export { defineData } from './define-data';
export { defineView, embed, pick } from './define-view';
export { defineEndpoint } from './define-endpoint';
export { field } from './field';
export { hasOne, hasMany, belongsTo } from './relations';

// Re-export types
export type {
  FieldDefinition,
  EntitySchema,
  ViewSchema,
  EndpointSchema,
  RelationDefinition,
  ComputedDefinition,
} from './types';
