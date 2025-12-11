/**
 * Schema Registry - Stores metadata about all defined schemas
 *
 * This is the central registry that holds all entity and view definitions.
 * Used by resolvers to look up schema information at runtime.
 */

import {
  EntitySchema,
  ViewSchema,
  FieldDefinition,
  RelationDefinition,
  ComputedDefinition,
} from '../../schema/types';

// Re-export types for convenience
export type {
  EntitySchema,
  ViewSchema,
  FieldDefinition,
  RelationDefinition,
  ComputedDefinition,
};

/**
 * Schema Registry class
 *
 * Singleton that stores all registered entity and view schemas.
 */
class SchemaRegistry {
  private entities: Map<string, EntitySchema> = new Map();
  private views: Map<string, ViewSchema> = new Map();

  /**
   * Register an entity schema
   */
  registerEntity(schema: EntitySchema): void {
    if (this.entities.has(schema.name)) {
      console.warn(`Entity "${schema.name}" is already registered. Overwriting.`);
    }
    this.entities.set(schema.name, schema);
  }

  /**
   * Register a view schema
   */
  registerView(schema: ViewSchema): void {
    if (this.views.has(schema.name)) {
      console.warn(`View "${schema.name}" is already registered. Overwriting.`);
    }
    this.views.set(schema.name, schema);
  }

  /**
   * Get an entity schema by name
   */
  getEntity(name: string): EntitySchema | undefined {
    return this.entities.get(name);
  }

  /**
   * Get a view schema by name
   */
  getView(name: string): ViewSchema | undefined {
    return this.views.get(name);
  }

  /**
   * Get all registered entities
   */
  getAllEntities(): EntitySchema[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get all registered views
   */
  getAllViews(): ViewSchema[] {
    return Array.from(this.views.values());
  }

  /**
   * Check if an entity exists
   */
  hasEntity(name: string): boolean {
    return this.entities.has(name);
  }

  /**
   * Check if a view exists
   */
  hasView(name: string): boolean {
    return this.views.has(name);
  }

  /**
   * Clear all registered schemas (useful for testing)
   */
  clear(): void {
    this.entities.clear();
    this.views.clear();
  }

  /**
   * Get entity names
   */
  getEntityNames(): string[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Get view names
   */
  getViewNames(): string[] {
    return Array.from(this.views.keys());
  }
}

// Singleton instance
export const registry = new SchemaRegistry();
