/**
 * Relationship definitions for schema
 *
 * Usage:
 *   profile: hasOne('userProfile', { foreignKey: 'userId', eager: true })
 *   posts: hasMany('post', { foreignKey: 'authorId', orderBy: { createdAt: 'desc' } })
 *   author: belongsTo('user', { foreignKey: 'authorId' })
 */

import { RelationDefinition } from './types';

export interface HasOneOptions {
  foreignKey?: string;
  eager?: boolean;
}

export interface HasManyOptions {
  foreignKey?: string;
  eager?: boolean;
  through?: string;
  otherKey?: string;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface BelongsToOptions {
  foreignKey?: string;
  eager?: boolean;
}

/**
 * Define a one-to-one relationship where this entity has one related entity.
 * The foreign key is on the related entity.
 *
 * @example
 * const User = defineData('user', {
 *   profile: hasOne('userProfile', { foreignKey: 'userId', eager: true }),
 * });
 */
export function hasOne(
  target: string,
  options: HasOneOptions = {}
): RelationDefinition {
  return {
    type: 'hasOne',
    target,
    foreignKey: options.foreignKey ?? `${target}Id`,
    eager: options.eager ?? false,
  };
}

/**
 * Define a one-to-many relationship where this entity has many related entities.
 * The foreign key is on the related entities.
 *
 * @example
 * const User = defineData('user', {
 *   posts: hasMany('post', {
 *     foreignKey: 'authorId',
 *     orderBy: { createdAt: 'desc' },
 *     limit: 10,
 *   }),
 * });
 */
export function hasMany(
  target: string,
  options: HasManyOptions = {}
): RelationDefinition {
  return {
    type: 'hasMany',
    target,
    foreignKey: options.foreignKey ?? `${target}Id`,
    eager: options.eager ?? false,
    through: options.through,
    limit: options.limit,
    orderBy: options.orderBy,
  };
}

/**
 * Define a many-to-one relationship where this entity belongs to another.
 * The foreign key is on this entity.
 *
 * @example
 * const Post = defineData('post', {
 *   authorId: field.uuid(),
 *   author: belongsTo('user', { foreignKey: 'authorId', eager: true }),
 * });
 */
export function belongsTo(
  target: string,
  options: BelongsToOptions = {}
): RelationDefinition {
  return {
    type: 'belongsTo',
    target,
    foreignKey: options.foreignKey ?? `${target}Id`,
    eager: options.eager ?? false,
  };
}
