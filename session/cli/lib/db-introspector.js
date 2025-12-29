/**
 * Database Introspector - Live database schema introspection
 *
 * Connects to live databases and extracts schema information
 * for use in project maps.
 *
 * @module db-introspector
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Lazy-load pg driver
let pg = null;
function getPg() {
  if (!pg) {
    try {
      pg = require('pg');
    } catch (e) {
      throw new Error(
        'PostgreSQL driver not installed.\n' +
        'Install it with: npm install pg\n' +
        'Or run from a directory with pg in node_modules.'
      );
    }
  }
  return pg;
}

/**
 * Base class for database introspection
 * Extensible for PostgreSQL, MySQL, SQLite, MongoDB
 */
class DatabaseIntrospector {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.timeout = options.timeout || 30000;
    this.schema = options.schema || 'public';
  }

  /**
   * Parse a database connection string URL
   * @param {string} connectionString - Database URL (e.g., postgres://user:pass@host:port/db)
   * @returns {Object} Parsed credentials
   */
  parseConnectionString(connectionString) {
    try {
      const url = new URL(connectionString);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1), // Remove leading /
        user: url.username,
        password: decodeURIComponent(url.password || ''),
        ssl: true
      };
    } catch (e) {
      throw new Error(`Invalid connection string: ${e.message}`);
    }
  }

  /**
   * Build credentials from environment variables
   * @returns {Object|null} Credentials or null if not found
   */
  buildCredentialsFromEnv() {
    // Priority 1: DATABASE_URL
    if (process.env.DATABASE_URL) {
      return this.parseConnectionString(process.env.DATABASE_URL);
    }

    // Priority 2: SUPABASE_DB_URL
    if (process.env.SUPABASE_DB_URL) {
      return this.parseConnectionString(process.env.SUPABASE_DB_URL);
    }

    // Priority 3: Individual PG* variables
    if (process.env.PGHOST) {
      return {
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE || 'postgres',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        ssl: process.env.PGSSLMODE !== 'disable'
      };
    }

    return null;
  }

  /**
   * Build credentials from CLI options and environment
   * @param {Object} options - CLI options
   * @returns {Object} Resolved credentials
   */
  resolveCredentials(options) {
    // Priority 1: Connection string from CLI
    if (options.connectionString || options.url) {
      return this.parseConnectionString(options.connectionString || options.url);
    }

    // Priority 2: Individual CLI params
    if (options.host) {
      return {
        host: options.host,
        port: options.port || 5432,
        database: options.database || 'postgres',
        user: options.user || 'postgres',
        password: options.password || '',
        ssl: options.ssl !== false
      };
    }

    // Priority 3: Environment variables
    const envCreds = this.buildCredentialsFromEnv();
    if (envCreds) {
      return envCreds;
    }

    return null;
  }

  // Abstract methods - must be implemented by subclasses
  async connect(credentials) {
    throw new Error('connect() must be implemented by subclass');
  }

  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  async introspectTables() {
    throw new Error('introspectTables() must be implemented by subclass');
  }

  async introspectColumns() {
    throw new Error('introspectColumns() must be implemented by subclass');
  }

  async introspectPrimaryKeys() {
    throw new Error('introspectPrimaryKeys() must be implemented by subclass');
  }

  async introspectForeignKeys() {
    throw new Error('introspectForeignKeys() must be implemented by subclass');
  }

  async introspectIndexes() {
    throw new Error('introspectIndexes() must be implemented by subclass');
  }

  async introspectEnums() {
    throw new Error('introspectEnums() must be implemented by subclass');
  }

  async introspectUniqueConstraints() {
    throw new Error('introspectUniqueConstraints() must be implemented by subclass');
  }

  /**
   * Map native database type to standard type
   * @param {string} nativeType - Database-specific type
   * @returns {string} Standard type name
   */
  mapType(nativeType) {
    throw new Error('mapType() must be implemented by subclass');
  }

  /**
   * Main introspection entry point
   * @param {Object} credentials - Database credentials
   * @returns {Object} Schema in database-schema.json format
   */
  async introspect(credentials) {
    await this.connect(credentials);

    try {
      const [tables, columns, primaryKeys, foreignKeys, indexes, enums, uniqueConstraints] =
        await Promise.all([
          this.introspectTables(),
          this.introspectColumns(),
          this.introspectPrimaryKeys(),
          this.introspectForeignKeys(),
          this.introspectIndexes(),
          this.introspectEnums(),
          this.introspectUniqueConstraints()
        ]);

      return this.buildSchema(tables, columns, primaryKeys, foreignKeys, indexes, enums, uniqueConstraints);
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Build schema object matching database-schema.json format
   */
  buildSchema(tables, columns, primaryKeys, foreignKeys, indexes, enums, uniqueConstraints) {
    // Group data by table
    const columnsByTable = this.groupBy(columns, 'table_name');
    const pkByTable = this.groupBy(primaryKeys, 'table_name');
    const fkByTable = this.groupBy(foreignKeys, 'table_name');
    const indexesByTable = this.groupBy(indexes, 'table_name');
    const uniqueByTable = this.groupBy(uniqueConstraints, 'table_name');

    // Build enum lookup
    const enumLookup = {};
    for (const e of enums) {
      if (!enumLookup[e.enum_name]) {
        enumLookup[e.enum_name] = [];
      }
      enumLookup[e.enum_name].push(e.enum_value);
    }

    // Build tables array
    const tablesArray = tables.map(table => {
      const tableName = table.table_name;
      const tableColumns = columnsByTable[tableName] || [];
      const tablePKs = pkByTable[tableName] || [];
      const tableFKs = fkByTable[tableName] || [];
      const tableIndexes = indexesByTable[tableName] || [];
      const tableUniques = uniqueByTable[tableName] || [];

      const pkColumnNames = new Set(tablePKs.map(pk => pk.column_name));
      const uniqueColumnNames = new Set(tableUniques.map(u => u.column_name));

      // Build columns
      const cols = tableColumns.map(col => {
        const isEnum = enumLookup[col.udt_name] !== undefined;

        return {
          name: col.column_name,
          type: isEnum ? 'Enum' : this.mapType(col.data_type, col.udt_name),
          nullable: col.is_nullable === 'YES',
          isPrimary: pkColumnNames.has(col.column_name),
          isUnique: uniqueColumnNames.has(col.column_name) || pkColumnNames.has(col.column_name),
          hasDefault: col.column_default !== null,
          isArray: col.data_type === 'ARRAY',
          enumValues: isEnum ? enumLookup[col.udt_name] : null,
          references: null // Will be populated from FK data
        };
      });

      // Add FK references to columns
      for (const fk of tableFKs) {
        const col = cols.find(c => c.name === fk.column_name);
        if (col) {
          col.references = {
            table: fk.foreign_table_name,
            column: fk.foreign_column_name
          };
        }
      }

      // Build relationships from FKs
      const relationships = tableFKs.map(fk => ({
        type: 'belongsTo',
        targetTable: fk.foreign_table_name,
        foreignKey: fk.column_name
      }));

      // Build indexes
      const indexArray = this.parseIndexes(tableIndexes, pkColumnNames);

      // Determine primary key
      const primaryKey = tablePKs.length > 0 ? tablePKs[0].column_name : null;

      return {
        name: this.toPascalCase(tableName),
        tableName: tableName,
        source: 'introspection:postgres',
        orm: 'PostgreSQL',
        columns: cols,
        relationships: relationships,
        indexes: indexArray,
        primaryKey: primaryKey
      };
    });

    // Calculate statistics
    const stats = {
      totalTables: tablesArray.length,
      totalColumns: tablesArray.reduce((sum, t) => sum + t.columns.length, 0),
      totalRelationships: tablesArray.reduce((sum, t) => sum + t.relationships.length, 0),
      totalIndexes: tablesArray.reduce((sum, t) => sum + t.indexes.length, 0),
      tablesWithPrimaryKey: tablesArray.filter(t => t.primaryKey !== null).length,
      tablesWithRelationships: tablesArray.filter(t => t.relationships.length > 0).length
    };

    // Generate project hash
    const crypto = require('crypto');
    const projectHash = crypto
      .createHash('md5')
      .update(this.projectRoot)
      .digest('hex')
      .substring(0, 16);

    return {
      version: '1.0.0',
      projectHash: projectHash,
      generated: new Date().toISOString(),
      mapType: 'database-schema',

      detection: {
        orms: [],
        primaryORM: null,
        summary: {
          totalORMs: 0,
          primaryORM: null,
          hasSchemaFiles: false,
          hasMigrations: false,
          hasModels: false,
          hasSeeds: false,
          modelFileCount: 0,
          migrationFileCount: 0,
          schemaFileCount: 0
        }
      },

      introspectionSource: {
        type: 'live',
        database: 'PostgreSQL',
        schema: this.schema
      },

      schemaFiles: [],
      migrationDirectories: [],
      modelFiles: [],
      tables: tablesArray,
      statistics: stats
    };
  }

  /**
   * Parse index definitions from pg_indexes
   */
  parseIndexes(indexRows, pkColumnNames) {
    const indexes = [];

    for (const idx of indexRows) {
      // Skip primary key indexes
      if (idx.indexname.endsWith('_pkey')) continue;

      // Parse columns from indexdef
      // Format: CREATE [UNIQUE] INDEX name ON table USING btree (col1, col2)
      const match = idx.indexdef.match(/\(([^)]+)\)/);
      if (!match) continue;

      const columns = match[1]
        .split(',')
        .map(c => c.trim().split(' ')[0]); // Remove ASC/DESC

      const isUnique = idx.indexdef.includes('UNIQUE');

      indexes.push({
        columns: columns,
        type: columns.length > 1 ? 'compound-index' : (isUnique ? 'unique-index' : 'index')
      });
    }

    return indexes;
  }

  /**
   * Helper: Group array by key
   */
  groupBy(array, key) {
    return array.reduce((acc, item) => {
      const k = item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  /**
   * Helper: Convert snake_case to PascalCase
   */
  toPascalCase(str) {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}


/**
 * PostgreSQL introspector using 'pg' driver
 * Supports Supabase direct and pooler connections
 */
class PostgresIntrospector extends DatabaseIntrospector {
  constructor(options = {}) {
    super(options);
    this.client = null;
    this.enumCache = new Map();
  }

  /**
   * Connect to PostgreSQL database
   */
  async connect(credentials) {
    const { Client } = getPg();

    const config = this.buildConfig(credentials);

    this.client = new Client(config);

    // Race between connect and timeout
    const connectPromise = this.client.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), this.timeout)
    );

    await Promise.race([connectPromise, timeoutPromise]);
  }

  /**
   * Build pg client configuration
   */
  buildConfig(credentials) {
    // Detect Supabase pooler
    const isPooler = credentials.port === 6543 ||
                     (credentials.host && credentials.host.includes('.pooler.supabase'));

    const baseConfig = {
      connectionTimeoutMillis: isPooler ? 10000 : 5000,
      query_timeout: this.timeout
    };

    // Connection string mode
    if (credentials.connectionString) {
      return {
        connectionString: credentials.connectionString,
        ssl: credentials.ssl !== false ? { rejectUnauthorized: false } : false,
        ...baseConfig
      };
    }

    // Individual params mode
    return {
      host: credentials.host,
      port: credentials.port || 5432,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      ssl: credentials.ssl !== false ? { rejectUnauthorized: false } : false,
      ...baseConfig
    };
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  /**
   * Get all tables in schema
   */
  async introspectTables() {
    const query = `
      SELECT
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_name
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Get all columns for all tables
   */
  async introspectColumns() {
    const query = `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale
      FROM information_schema.columns c
      WHERE c.table_schema = $1
      ORDER BY c.table_name, c.ordinal_position
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Get primary key constraints
   */
  async introspectPrimaryKeys() {
    const query = `
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
      ORDER BY tc.table_name, kcu.ordinal_position
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Get foreign key constraints
   */
  async introspectForeignKeys() {
    const query = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Get indexes
   */
  async introspectIndexes() {
    const query = `
      SELECT
        schemaname,
        tablename AS table_name,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = $1
      ORDER BY tablename, indexname
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Get enum types and their values
   */
  async introspectEnums() {
    const query = `
      SELECT
        t.typname AS enum_name,
        e.enumlabel AS enum_value,
        e.enumsortorder
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = $1
      ORDER BY t.typname, e.enumsortorder
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Get unique constraints
   */
  async introspectUniqueConstraints() {
    const query = `
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = $1
    `;

    const result = await this.client.query(query, [this.schema]);
    return result.rows;
  }

  /**
   * Map PostgreSQL types to standard types
   */
  mapType(dataType, udtName) {
    // Handle array types
    if (dataType === 'ARRAY') {
      const elementType = udtName.startsWith('_') ? udtName.slice(1) : udtName;
      return `Array<${this.mapType(elementType, elementType)}>`;
    }

    // Type mapping table
    const typeMap = {
      // Integers
      'smallint': 'Int',
      'int2': 'Int',
      'integer': 'Int',
      'int': 'Int',
      'int4': 'Int',
      'bigint': 'BigInt',
      'int8': 'BigInt',

      // Floats
      'real': 'Float',
      'float4': 'Float',
      'double precision': 'Float',
      'float8': 'Float',
      'numeric': 'Decimal',
      'decimal': 'Decimal',

      // Strings
      'character varying': 'String',
      'varchar': 'String',
      'character': 'String',
      'char': 'String',
      'text': 'String',
      'name': 'String',

      // Boolean
      'boolean': 'Boolean',
      'bool': 'Boolean',

      // Date/Time
      'timestamp without time zone': 'DateTime',
      'timestamp with time zone': 'DateTime',
      'timestamp': 'DateTime',
      'timestamptz': 'DateTime',
      'date': 'Date',
      'time without time zone': 'Time',
      'time with time zone': 'Time',
      'time': 'Time',
      'timetz': 'Time',
      'interval': 'Interval',

      // UUID
      'uuid': 'UUID',

      // JSON
      'json': 'Json',
      'jsonb': 'Json',

      // Binary
      'bytea': 'Bytes',

      // Special
      'inet': 'String',
      'cidr': 'String',
      'macaddr': 'String',
      'money': 'Decimal',
      'tsvector': 'String',
      'tsquery': 'String',
      'xml': 'String',
      'point': 'String',
      'line': 'String',
      'lseg': 'String',
      'box': 'String',
      'path': 'String',
      'polygon': 'String',
      'circle': 'String',

      // User-defined (enums handled separately)
      'USER-DEFINED': 'Enum'
    };

    // Check lowercase versions
    const lowerType = (dataType || '').toLowerCase();
    const lowerUdt = (udtName || '').toLowerCase();

    return typeMap[lowerType] || typeMap[lowerUdt] || 'Unknown';
  }
}


/**
 * Get error suggestion based on error code
 */
function getErrorSuggestion(error) {
  const code = error.code || '';

  const suggestions = {
    'ECONNREFUSED': 'Check that the database server is running and accessible at the specified host/port',
    'ENOTFOUND': 'Verify the hostname is correct and DNS is resolving properly',
    'ETIMEDOUT': 'Connection timed out - check firewall settings and network connectivity',
    'ECONNRESET': 'Connection was reset - the server may have closed the connection',
    '28000': 'Authentication failed - verify username and ensure user has login permission',
    '28P01': 'Password authentication failed - check password is correct',
    '3D000': 'Database does not exist - verify database name',
    '42501': 'Insufficient privileges - user may not have SELECT access on information_schema',
    '53300': 'Too many connections - try again later or increase max_connections',
    'CERT_HAS_EXPIRED': 'SSL certificate expired - try --no-ssl or update server certificates',
    'DEPTH_ZERO_SELF_SIGNED_CERT': 'Self-signed certificate - this is handled automatically with rejectUnauthorized: false',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'SSL verification failed - try --no-ssl for testing'
  };

  return suggestions[code] || 'Check connection parameters and try again';
}


module.exports = {
  DatabaseIntrospector,
  PostgresIntrospector,
  getErrorSuggestion
};
