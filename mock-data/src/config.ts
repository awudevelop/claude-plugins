/**
 * MockData Configuration
 *
 * Central configuration for adapters, middleware, and runtime behavior.
 */

import { Adapter } from './adapters/types';
import { Middleware, MiddlewareContext } from './middleware/types';
import { createFetchAdapter } from './adapters/fetch';
import { AdapterContext, AdapterResponse } from './adapters/types';

/**
 * Configuration options
 */
export interface DataLayerConfig {
  /** Default adapter for all entities */
  adapter?: Adapter;

  /** Per-entity adapter overrides */
  adapters?: Record<string, Adapter>;

  /** Global middleware (applied to all entities) */
  middleware?: Middleware[];

  /** Per-entity middleware */
  entityMiddleware?: Record<string, Middleware[]>;
}

/**
 * Middleware chain that executes middleware and adapter
 */
class MiddlewareChain {
  private middlewares: Middleware[] = [];
  private adapter: Adapter;

  constructor(adapter: Adapter) {
    this.adapter = adapter;
  }

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute<T>(
    operation: 'findOne' | 'findMany' | 'create' | 'update' | 'delete' | 'custom',
    baseContext: AdapterContext
  ): Promise<AdapterResponse<T>> {
    const ctx: MiddlewareContext = {
      ...baseContext,
      operation,
      state: {},
    };

    return this.executeWithRetry(ctx, operation);
  }

  private async executeWithRetry<T>(
    ctx: MiddlewareContext,
    operation: string,
    maxRetries: number = 3
  ): Promise<AdapterResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Run 'before' middlewares
        for (const mw of this.middlewares) {
          if (mw.before) {
            const result = await mw.before(ctx);

            if (result?.response) {
              return result.response as AdapterResponse<T>;
            }

            if (result?.error) {
              throw result.error;
            }

            if (result?.context) {
              Object.assign(ctx, result.context);
            }
          }
        }

        // Call adapter
        const adapterMethod = this.adapter[operation as keyof Adapter] as Function;
        let response = await adapterMethod.call(this.adapter, ctx);

        // Run 'after' middlewares (reverse order)
        for (const mw of [...this.middlewares].reverse()) {
          if (mw.after) {
            response = await mw.after(ctx, response);
          }
        }

        return response as AdapterResponse<T>;
      } catch (error) {
        lastError = error as Error;

        // Run 'onError' middlewares
        let shouldRetry = false;

        for (const mw of this.middlewares) {
          if (mw.onError) {
            const result = await mw.onError(ctx, lastError);

            if (result?.context) {
              Object.assign(ctx, result.context);
              shouldRetry = true;
              break;
            }

            if (result?.response) {
              return result.response as AdapterResponse<T>;
            }

            if (result?.error) {
              lastError = result.error;
            }
          }
        }

        if (!shouldRetry) {
          throw lastError;
        }
      }
    }

    throw lastError;
  }
}

/**
 * Data layer instance
 */
class DataLayerInstance {
  private config: DataLayerConfig = {};
  private chains: Map<string, MiddlewareChain> = new Map();

  /**
   * Configure the data layer
   */
  configure(config: DataLayerConfig): void {
    this.config = config;
    this.chains.clear();
  }

  /**
   * Get middleware chain for an entity
   */
  getChain(entityName: string): MiddlewareChain {
    if (this.chains.has(entityName)) {
      return this.chains.get(entityName)!;
    }

    // Get adapter (entity-specific or default)
    const adapter =
      this.config.adapters?.[entityName] ??
      this.config.adapter ??
      createFetchAdapter();

    // Build middleware chain
    const chain = new MiddlewareChain(adapter);

    // Add global middleware
    for (const mw of this.config.middleware ?? []) {
      chain.use(mw);
    }

    // Add entity-specific middleware
    for (const mw of this.config.entityMiddleware?.[entityName] ?? []) {
      chain.use(mw);
    }

    this.chains.set(entityName, chain);
    return chain;
  }

  /**
   * Clear cached chains (useful when reconfiguring)
   */
  clearChains(): void {
    this.chains.clear();
  }
}

/**
 * Singleton data layer instance
 */
export const dataLayer = new DataLayerInstance();

/**
 * Configure the data layer
 *
 * @example
 * configureDataLayer({
 *   adapter: createFetchAdapter({ baseUrl: 'https://api.example.com' }),
 *   middleware: [authMiddleware, retryMiddleware],
 * });
 */
export function configureDataLayer(config: DataLayerConfig): void {
  dataLayer.configure(config);
}
