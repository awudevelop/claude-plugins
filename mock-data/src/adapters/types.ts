/**
 * Adapter types and interfaces
 *
 * Adapters provide a pluggable abstraction layer between MockData
 * and various backend implementations.
 */

/**
 * Context passed to adapter methods
 */
export interface AdapterContext {
  /** Entity name (e.g., 'user', 'post') */
  entity: string;

  /** Operation being performed */
  operation: 'findOne' | 'findMany' | 'create' | 'update' | 'delete' | 'custom';

  /** API endpoint path */
  endpoint?: string;

  /** Query parameters */
  params?: {
    id?: string;
    include?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    [key: string]: any;
  };

  /** Request body data */
  data?: any;

  /** HTTP headers */
  headers?: Record<string, string>;

  /** AbortController signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Response from adapter methods
 */
export interface AdapterResponse<T = any> {
  /** Response data */
  data: T;

  /** Response metadata */
  meta?: {
    total?: number;
    page?: number;
    headers?: Record<string, string>;
    fromCache?: boolean;
  };
}

/**
 * Adapter interface
 *
 * All adapters must implement these methods.
 */
export interface Adapter {
  /** Adapter name for identification */
  name: string;

  /** Find a single entity by ID */
  findOne<T>(ctx: AdapterContext): Promise<AdapterResponse<T>>;

  /** Find multiple entities */
  findMany<T>(ctx: AdapterContext): Promise<AdapterResponse<T[]>>;

  /** Create a new entity */
  create<T>(ctx: AdapterContext): Promise<AdapterResponse<T>>;

  /** Update an existing entity */
  update<T>(ctx: AdapterContext): Promise<AdapterResponse<T>>;

  /** Delete an entity */
  delete(ctx: AdapterContext): Promise<AdapterResponse<void>>;

  /** Custom operation for views and special endpoints */
  custom<T>(ctx: AdapterContext): Promise<AdapterResponse<T>>;
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory<TConfig = any> = (config: TConfig) => Adapter;

/**
 * Error thrown by adapters
 */
export class AdapterError extends Error {
  constructor(
    public status: number,
    public body: string,
    public context: AdapterContext
  ) {
    super(`Adapter error: HTTP ${status}`);
    this.name = 'AdapterError';
  }

  /**
   * Check if error is a specific HTTP status
   */
  is(status: number): boolean {
    return this.status === status;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}
