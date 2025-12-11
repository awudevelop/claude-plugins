/**
 * Core types for schema definitions
 */

export interface FieldDefinition {
  type: string;
  faker?: () => any;
  nullable?: boolean;
  unique?: boolean;
  readOnly?: boolean;
  default?: any;
  min?: number;
  max?: number;
  pattern?: RegExp;
  values?: string[];  // For enums
  itemType?: FieldDefinition;  // For arrays
}

export interface RelationDefinition {
  type: 'hasOne' | 'hasMany' | 'belongsTo';
  target: string;
  foreignKey: string;
  eager: boolean;
  through?: string;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface ComputedDefinition {
  mock: () => any;
  resolve: (entity: any, db: any, context: any) => any;
  dependsOn?: string[];
}

export interface ApiConfig {
  basePath?: string;
  operations?: {
    list?: boolean | OperationConfig;
    get?: boolean | OperationConfig;
    create?: boolean | OperationConfig;
    update?: boolean | OperationConfig;
    delete?: boolean | OperationConfig;
    [key: string]: boolean | OperationConfig | undefined;
  };
  pagination?: {
    style: 'offset' | 'cursor';
    defaultLimit: number;
    maxLimit: number;
  };
  relationships?: Record<string, {
    endpoint?: boolean;
    operations?: string[];
  }>;
}

export interface OperationConfig {
  method?: string;
  path?: string;
  params?: string[];
}

export interface EntitySchema {
  name: string;
  primaryKey: string;
  fields: Record<string, FieldDefinition>;
  relations: Record<string, RelationDefinition>;
  computed: Record<string, ComputedDefinition>;
  api?: ApiConfig;
}

export interface EmbedDefinition {
  type: 'embed';
  target: string;
  relation?: string;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  where?: Record<string, any>;
}

export interface ViewSchema {
  name: string;
  baseEntity?: string;
  fields: Record<string, FieldDefinition | EmbedDefinition>;
  computed: Record<string, ComputedDefinition>;
  endpoint: string;
  params: string[];
  mockResolver?: (db: any, params: any, context: any) => any;
}

export interface EndpointSchema {
  path: string;
  method: string;
  params?: Record<string, FieldDefinition>;
  request?: Record<string, FieldDefinition>;
  response: Record<string, FieldDefinition>;
  mockResolver?: (db: any, params: any, context: any) => any;
}
