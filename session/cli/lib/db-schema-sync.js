/**
 * Database Schema Sync - Compare and merge code vs live database schemas
 *
 * Detects drift between ORM-defined schema and actual database state,
 * providing warnings and unified views for development.
 *
 * @module db-schema-sync
 */

const fs = require('fs').promises;
const path = require('path');
const compression = require('./compression');

/**
 * Sync status severity levels
 */
const SEVERITY = {
  CRITICAL: 'critical',  // Code will break
  WARNING: 'warning',    // May cause issues
  INFO: 'info'           // Drift detected but won't break code
};

/**
 * Drift types
 */
const DRIFT_TYPES = {
  // Critical - code will break
  TABLE_MISSING_IN_DB: 'table_missing_in_db',
  COLUMN_MISSING_IN_DB: 'column_missing_in_db',
  TYPE_INCOMPATIBLE: 'type_incompatible',

  // Warning - may cause issues
  TYPE_MISMATCH: 'type_mismatch',
  NULLABLE_MISMATCH: 'nullable_mismatch',
  PRIMARY_KEY_MISMATCH: 'pk_mismatch',
  RELATIONSHIP_MISSING_IN_DB: 'relationship_missing_in_db',

  // Info - drift detected
  TABLE_MISSING_IN_CODE: 'table_missing_in_code',
  COLUMN_MISSING_IN_CODE: 'column_missing_in_code',
  INDEX_MISSING_IN_DB: 'index_missing_in_db',
  INDEX_MISSING_IN_CODE: 'index_missing_in_code',
  RELATIONSHIP_MISSING_IN_CODE: 'relationship_missing_in_code'
};

/**
 * Type compatibility map - which types are compatible
 */
const TYPE_COMPATIBILITY = {
  'String': ['String', 'Text', 'Varchar', 'Char'],
  'Int': ['Int', 'Integer', 'SmallInt', 'BigInt'],
  'BigInt': ['BigInt', 'Int'],
  'Float': ['Float', 'Double', 'Real', 'Decimal', 'Numeric'],
  'Decimal': ['Decimal', 'Numeric', 'Float', 'Double'],
  'Boolean': ['Boolean', 'Bool'],
  'DateTime': ['DateTime', 'Timestamp', 'Date', 'Time'],
  'Date': ['Date', 'DateTime'],
  'UUID': ['UUID', 'String'],
  'Json': ['Json', 'Jsonb', 'Object'],
  'Bytes': ['Bytes', 'Bytea', 'Binary']
};

/**
 * Check if two types are compatible
 */
function areTypesCompatible(type1, type2) {
  if (!type1 || !type2) return true; // Unknown types considered compatible

  const t1 = type1.replace(/\?$/, '').replace(/\[\]$/, '');
  const t2 = type2.replace(/\?$/, '').replace(/\[\]$/, '');

  if (t1 === t2) return true;

  const compatible1 = TYPE_COMPATIBILITY[t1] || [t1];
  const compatible2 = TYPE_COMPATIBILITY[t2] || [t2];

  return compatible1.some(t => compatible2.includes(t)) ||
         compatible2.some(t => compatible1.includes(t));
}

/**
 * Check if types are exact match (for warnings)
 */
function areTypesExactMatch(type1, type2) {
  if (!type1 || !type2) return true;
  return type1 === type2;
}

/**
 * Database Schema Sync class
 */
class DatabaseSchemaSync {
  constructor(projectRoot) {
    this.projectRoot = projectRoot || process.cwd();
    this.mapsDir = path.join(this.projectRoot, '.claude', 'project-maps');
  }

  /**
   * Load both schemas
   * @returns {Object} { live, code, hasLive, hasCode }
   */
  async loadSchemas() {
    const liveSchemaPath = path.join(this.mapsDir, 'database-schema-live.json');
    const codeSchemaPath = path.join(this.mapsDir, 'database-schema.json');

    let live = null;
    let code = null;

    try {
      live = await compression.loadAndDecompress(liveSchemaPath);
    } catch (e) {
      // Live schema doesn't exist
    }

    try {
      code = await compression.loadAndDecompress(codeSchemaPath);
    } catch (e) {
      // Code schema doesn't exist
    }

    return {
      live,
      code,
      hasLive: live !== null,
      hasCode: code !== null
    };
  }

  /**
   * Compare two schemas and return differences
   * @param {Object} liveSchema - Schema from live database introspection
   * @param {Object} codeSchema - Schema from ORM file parsing
   * @returns {Object} Comparison result with drift items
   */
  compareSchemas(liveSchema, codeSchema) {
    const result = {
      inSync: true,
      critical: [],
      warnings: [],
      info: [],
      summary: {
        tablesInBoth: 0,
        tablesOnlyInCode: 0,
        tablesOnlyInDb: 0,
        columnsWithDrift: 0,
        totalDriftItems: 0
      }
    };

    if (!liveSchema || !codeSchema) {
      return result;
    }

    const liveTables = this.buildTableMap(liveSchema.tables || []);
    const codeTables = this.buildTableMap(codeSchema.tables || []);

    const allTableNames = new Set([
      ...Object.keys(liveTables),
      ...Object.keys(codeTables)
    ]);

    for (const tableName of allTableNames) {
      const liveTable = liveTables[tableName];
      const codeTable = codeTables[tableName];

      if (codeTable && !liveTable) {
        // Table in code but not in DB - CRITICAL
        result.critical.push({
          type: DRIFT_TYPES.TABLE_MISSING_IN_DB,
          severity: SEVERITY.CRITICAL,
          table: tableName,
          message: `Table "${tableName}" defined in code but missing in database`,
          suggestion: 'Run database migration to create table'
        });
        result.summary.tablesOnlyInCode++;
        result.inSync = false;
      } else if (liveTable && !codeTable) {
        // Table in DB but not in code - INFO
        result.info.push({
          type: DRIFT_TYPES.TABLE_MISSING_IN_CODE,
          severity: SEVERITY.INFO,
          table: tableName,
          message: `Table "${tableName}" exists in database but not in code`,
          suggestion: 'Add to ORM schema or document as external table'
        });
        result.summary.tablesOnlyInDb++;
      } else {
        // Table exists in both - compare columns
        result.summary.tablesInBoth++;
        this.compareTableColumns(liveTable, codeTable, result);
        this.compareTableIndexes(liveTable, codeTable, result);
        this.compareTableRelationships(liveTable, codeTable, result);
      }
    }

    result.summary.totalDriftItems =
      result.critical.length + result.warnings.length + result.info.length;

    return result;
  }

  /**
   * Build a map of tables by name (normalized to lowercase)
   */
  buildTableMap(tables) {
    const map = {};
    for (const table of tables) {
      const key = (table.tableName || table.name || '').toLowerCase();
      if (key) {
        map[key] = table;
      }
    }
    return map;
  }

  /**
   * Compare columns between two tables
   */
  compareTableColumns(liveTable, codeTable, result) {
    const tableName = liveTable.tableName || liveTable.name;

    const liveColumns = this.buildColumnMap(liveTable.columns || []);
    const codeColumns = this.buildColumnMap(codeTable.columns || []);

    const allColumnNames = new Set([
      ...Object.keys(liveColumns),
      ...Object.keys(codeColumns)
    ]);

    for (const colName of allColumnNames) {
      const liveCol = liveColumns[colName];
      const codeCol = codeColumns[colName];

      if (codeCol && !liveCol) {
        // Column in code but not in DB - CRITICAL
        result.critical.push({
          type: DRIFT_TYPES.COLUMN_MISSING_IN_DB,
          severity: SEVERITY.CRITICAL,
          table: tableName,
          column: colName,
          codeType: codeCol.type,
          message: `Column "${tableName}.${colName}" (${codeCol.type}) in code but missing in database`,
          suggestion: 'Run migration to add column'
        });
        result.summary.columnsWithDrift++;
        result.inSync = false;
      } else if (liveCol && !codeCol) {
        // Column in DB but not in code - INFO
        result.info.push({
          type: DRIFT_TYPES.COLUMN_MISSING_IN_CODE,
          severity: SEVERITY.INFO,
          table: tableName,
          column: colName,
          dbType: liveCol.type,
          message: `Column "${tableName}.${colName}" (${liveCol.type}) in database but not in code`,
          suggestion: 'Add to ORM schema or mark as database-managed'
        });
      } else {
        // Column in both - compare properties
        this.compareColumnProperties(tableName, colName, liveCol, codeCol, result);
      }
    }
  }

  /**
   * Build column map by name (normalized)
   */
  buildColumnMap(columns) {
    const map = {};
    for (const col of columns) {
      const key = (col.name || '').toLowerCase();
      if (key) {
        map[key] = col;
      }
    }
    return map;
  }

  /**
   * Compare individual column properties
   */
  compareColumnProperties(tableName, colName, liveCol, codeCol, result) {
    // Type compatibility check
    if (!areTypesCompatible(liveCol.type, codeCol.type)) {
      result.critical.push({
        type: DRIFT_TYPES.TYPE_INCOMPATIBLE,
        severity: SEVERITY.CRITICAL,
        table: tableName,
        column: colName,
        codeType: codeCol.type,
        dbType: liveCol.type,
        message: `Type incompatibility: "${tableName}.${colName}" is ${codeCol.type} in code but ${liveCol.type} in database`,
        suggestion: 'Update code type or run migration to change column type'
      });
      result.summary.columnsWithDrift++;
      result.inSync = false;
    } else if (!areTypesExactMatch(liveCol.type, codeCol.type)) {
      // Types compatible but not exact match - WARNING
      result.warnings.push({
        type: DRIFT_TYPES.TYPE_MISMATCH,
        severity: SEVERITY.WARNING,
        table: tableName,
        column: colName,
        codeType: codeCol.type,
        dbType: liveCol.type,
        message: `Type mismatch: "${tableName}.${colName}" is ${codeCol.type} in code but ${liveCol.type} in database`,
        suggestion: 'Consider aligning types for consistency'
      });
      result.summary.columnsWithDrift++;
    }

    // Nullable mismatch
    if (codeCol.nullable === false && liveCol.nullable === true) {
      result.warnings.push({
        type: DRIFT_TYPES.NULLABLE_MISMATCH,
        severity: SEVERITY.WARNING,
        table: tableName,
        column: colName,
        codeNullable: false,
        dbNullable: true,
        message: `Nullable mismatch: "${tableName}.${colName}" is NOT NULL in code but nullable in database`,
        suggestion: 'Code may fail on NULL values - add NOT NULL constraint to DB'
      });
    } else if (codeCol.nullable === true && liveCol.nullable === false) {
      result.info.push({
        type: DRIFT_TYPES.NULLABLE_MISMATCH,
        severity: SEVERITY.INFO,
        table: tableName,
        column: colName,
        codeNullable: true,
        dbNullable: false,
        message: `Nullable mismatch: "${tableName}.${colName}" is nullable in code but NOT NULL in database`,
        suggestion: 'Database is stricter than code - consider updating code'
      });
    }

    // Primary key mismatch
    if (codeCol.isPrimary && !liveCol.isPrimary) {
      result.warnings.push({
        type: DRIFT_TYPES.PRIMARY_KEY_MISMATCH,
        severity: SEVERITY.WARNING,
        table: tableName,
        column: colName,
        message: `Primary key mismatch: "${tableName}.${colName}" is PK in code but not in database`,
        suggestion: 'Add primary key constraint to database'
      });
    }
  }

  /**
   * Compare indexes between tables
   */
  compareTableIndexes(liveTable, codeTable, result) {
    const tableName = liveTable.tableName || liveTable.name;

    const liveIndexes = this.buildIndexMap(liveTable.indexes || []);
    const codeIndexes = this.buildIndexMap(codeTable.indexes || []);

    // Check for indexes in code but not DB
    for (const [key, codeIdx] of Object.entries(codeIndexes)) {
      if (!liveIndexes[key]) {
        result.info.push({
          type: DRIFT_TYPES.INDEX_MISSING_IN_DB,
          severity: SEVERITY.INFO,
          table: tableName,
          columns: codeIdx.columns,
          message: `Index on "${tableName}" (${codeIdx.columns.join(', ')}) defined in code but missing in database`,
          suggestion: 'Run migration to create index for better performance'
        });
      }
    }

    // Check for indexes in DB but not code
    for (const [key, liveIdx] of Object.entries(liveIndexes)) {
      if (!codeIndexes[key]) {
        result.info.push({
          type: DRIFT_TYPES.INDEX_MISSING_IN_CODE,
          severity: SEVERITY.INFO,
          table: tableName,
          columns: liveIdx.columns,
          message: `Index on "${tableName}" (${liveIdx.columns.join(', ')}) exists in database but not in code`,
          suggestion: 'Consider documenting index in ORM schema'
        });
      }
    }
  }

  /**
   * Build index map by column signature
   */
  buildIndexMap(indexes) {
    const map = {};
    for (const idx of indexes) {
      const key = (idx.columns || []).map(c => c.toLowerCase()).sort().join(',');
      if (key) {
        map[key] = idx;
      }
    }
    return map;
  }

  /**
   * Compare relationships between tables
   */
  compareTableRelationships(liveTable, codeTable, result) {
    const tableName = liveTable.tableName || liveTable.name;

    const liveRels = this.buildRelationshipMap(liveTable.relationships || []);
    const codeRels = this.buildRelationshipMap(codeTable.relationships || []);

    // Check for relationships in code but not DB
    for (const [key, codeRel] of Object.entries(codeRels)) {
      if (!liveRels[key]) {
        result.warnings.push({
          type: DRIFT_TYPES.RELATIONSHIP_MISSING_IN_DB,
          severity: SEVERITY.WARNING,
          table: tableName,
          targetTable: codeRel.targetTable,
          foreignKey: codeRel.foreignKey,
          message: `Relationship "${tableName}" → "${codeRel.targetTable}" in code but no FK constraint in database`,
          suggestion: 'Add foreign key constraint for data integrity'
        });
      }
    }

    // Check for relationships in DB but not code
    for (const [key, liveRel] of Object.entries(liveRels)) {
      if (!codeRels[key]) {
        result.info.push({
          type: DRIFT_TYPES.RELATIONSHIP_MISSING_IN_CODE,
          severity: SEVERITY.INFO,
          table: tableName,
          targetTable: liveRel.targetTable,
          foreignKey: liveRel.foreignKey,
          message: `FK constraint "${tableName}" → "${liveRel.targetTable}" in database but not in code`,
          suggestion: 'Add relationship to ORM schema'
        });
      }
    }
  }

  /**
   * Build relationship map by target+FK signature
   */
  buildRelationshipMap(relationships) {
    const map = {};
    for (const rel of relationships) {
      const key = `${(rel.targetTable || '').toLowerCase()}:${(rel.foreignKey || '').toLowerCase()}`;
      if (rel.targetTable) {
        map[key] = rel;
      }
    }
    return map;
  }

  /**
   * Merge schemas into unified view with sync annotations
   * @param {Object} liveSchema - Live database schema
   * @param {Object} codeSchema - Code/ORM schema
   * @returns {Object} Merged schema with annotations
   */
  mergeSchemas(liveSchema, codeSchema) {
    const comparison = this.compareSchemas(liveSchema, codeSchema);

    // Build drift lookup for quick access
    const driftByTable = {};
    const driftByColumn = {};

    for (const item of [...comparison.critical, ...comparison.warnings, ...comparison.info]) {
      const tableKey = (item.table || '').toLowerCase();
      if (!driftByTable[tableKey]) {
        driftByTable[tableKey] = [];
      }
      driftByTable[tableKey].push(item);

      if (item.column) {
        const colKey = `${tableKey}.${item.column.toLowerCase()}`;
        if (!driftByColumn[colKey]) {
          driftByColumn[colKey] = [];
        }
        driftByColumn[colKey].push(item);
      }
    }

    // Build merged tables
    const liveTables = this.buildTableMap(liveSchema?.tables || []);
    const codeTables = this.buildTableMap(codeSchema?.tables || []);

    const allTableNames = new Set([
      ...Object.keys(liveTables),
      ...Object.keys(codeTables)
    ]);

    const mergedTables = [];

    for (const tableName of allTableNames) {
      const liveTable = liveTables[tableName];
      const codeTable = codeTables[tableName];
      const tableDrift = driftByTable[tableName] || [];

      // Determine source and sync status
      let source = 'both';
      let syncStatus = 'ok';

      if (!liveTable) {
        source = 'code_only';
        syncStatus = 'critical';
      } else if (!codeTable) {
        source = 'db_only';
        syncStatus = 'info';
      } else if (tableDrift.some(d => d.severity === SEVERITY.CRITICAL)) {
        syncStatus = 'critical';
      } else if (tableDrift.some(d => d.severity === SEVERITY.WARNING)) {
        syncStatus = 'warning';
      } else if (tableDrift.length > 0) {
        syncStatus = 'info';
      }

      // Merge columns
      const mergedColumns = this.mergeColumns(
        liveTable?.columns || [],
        codeTable?.columns || [],
        tableName,
        driftByColumn
      );

      // Use live table as base (source of truth), fallback to code
      const baseTable = liveTable || codeTable;

      mergedTables.push({
        name: baseTable.name,
        tableName: baseTable.tableName || tableName,
        source,
        syncStatus,
        driftCount: tableDrift.length,
        columns: mergedColumns,
        relationships: liveTable?.relationships || codeTable?.relationships || [],
        indexes: liveTable?.indexes || codeTable?.indexes || [],
        primaryKey: liveTable?.primaryKey || codeTable?.primaryKey,
        orm: codeTable?.orm || liveTable?.orm || 'Unknown'
      });
    }

    // Sort tables: critical first, then warnings, then ok
    mergedTables.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2, ok: 3 };
      return (order[a.syncStatus] || 3) - (order[b.syncStatus] || 3);
    });

    // Calculate merged statistics
    const stats = {
      totalTables: mergedTables.length,
      totalColumns: mergedTables.reduce((sum, t) => sum + t.columns.length, 0),
      totalRelationships: mergedTables.reduce((sum, t) => sum + t.relationships.length, 0),
      totalIndexes: mergedTables.reduce((sum, t) => sum + t.indexes.length, 0),
      tablesInSync: mergedTables.filter(t => t.syncStatus === 'ok').length,
      tablesWithDrift: mergedTables.filter(t => t.syncStatus !== 'ok').length,
      criticalIssues: comparison.critical.length,
      warnings: comparison.warnings.length,
      infoItems: comparison.info.length
    };

    return {
      version: '1.0.0',
      generated: new Date().toISOString(),
      mapType: 'database-schema-unified',
      sources: {
        live: !!liveSchema,
        code: !!codeSchema,
        liveGenerated: liveSchema?.generated,
        codeGenerated: codeSchema?.generated
      },
      syncStatus: {
        inSync: comparison.inSync,
        critical: comparison.critical,
        warnings: comparison.warnings,
        info: comparison.info,
        summary: comparison.summary
      },
      tables: mergedTables,
      statistics: stats
    };
  }

  /**
   * Merge columns from live and code tables
   */
  mergeColumns(liveColumns, codeColumns, tableName, driftByColumn) {
    const liveMap = this.buildColumnMap(liveColumns);
    const codeMap = this.buildColumnMap(codeColumns);

    const allColNames = new Set([
      ...Object.keys(liveMap),
      ...Object.keys(codeMap)
    ]);

    const merged = [];

    for (const colName of allColNames) {
      const liveCol = liveMap[colName];
      const codeCol = codeMap[colName];
      const colKey = `${tableName.toLowerCase()}.${colName}`;
      const colDrift = driftByColumn[colKey] || [];

      let source = 'both';
      let syncStatus = 'ok';

      if (!liveCol) {
        source = 'code_only';
        syncStatus = 'critical';
      } else if (!codeCol) {
        source = 'db_only';
        syncStatus = 'info';
      } else if (colDrift.some(d => d.severity === SEVERITY.CRITICAL)) {
        syncStatus = 'critical';
      } else if (colDrift.some(d => d.severity === SEVERITY.WARNING)) {
        syncStatus = 'warning';
      } else if (colDrift.length > 0) {
        syncStatus = 'info';
      }

      // Prefer live column (source of truth)
      const baseCol = liveCol || codeCol;

      merged.push({
        name: baseCol.name,
        type: baseCol.type,
        nullable: baseCol.nullable,
        isPrimary: baseCol.isPrimary,
        isUnique: baseCol.isUnique,
        hasDefault: baseCol.hasDefault,
        source,
        syncStatus,
        drift: colDrift.length > 0 ? {
          codeType: codeCol?.type,
          dbType: liveCol?.type,
          issues: colDrift.map(d => d.message)
        } : null
      });
    }

    // Sort: critical first, then by name
    merged.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2, ok: 3 };
      const orderDiff = (order[a.syncStatus] || 3) - (order[b.syncStatus] || 3);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });

    return merged;
  }

  /**
   * Get quick sync status summary
   * @returns {Object} Sync status summary
   */
  async getSyncStatus() {
    const { live, code, hasLive, hasCode } = await this.loadSchemas();

    if (!hasLive && !hasCode) {
      return {
        status: 'no_schemas',
        message: 'No database schemas found',
        suggestion: 'Run /session:project-maps-generate for code schema, /session:project-maps-introspect for live schema'
      };
    }

    if (!hasLive) {
      return {
        status: 'code_only',
        message: 'Only code schema available (no live introspection)',
        suggestion: 'Run /session:project-maps-introspect to compare with actual database',
        codeStats: {
          tables: code.tables?.length || 0,
          generated: code.generated
        }
      };
    }

    if (!hasCode) {
      return {
        status: 'live_only',
        message: 'Only live schema available (no ORM schema detected)',
        suggestion: 'Run /session:project-maps-generate if project uses an ORM',
        liveStats: {
          tables: live.tables?.length || 0,
          generated: live.generated
        }
      };
    }

    // Both available - compare
    const comparison = this.compareSchemas(live, code);

    return {
      status: comparison.inSync ? 'in_sync' : 'drift_detected',
      inSync: comparison.inSync,
      message: comparison.inSync
        ? 'Database and code schemas are in sync'
        : `Schema drift detected: ${comparison.critical.length} critical, ${comparison.warnings.length} warnings`,
      critical: comparison.critical.length,
      warnings: comparison.warnings.length,
      info: comparison.info.length,
      summary: comparison.summary,
      liveStats: {
        tables: live.tables?.length || 0,
        generated: live.generated
      },
      codeStats: {
        tables: code.tables?.length || 0,
        generated: code.generated
      }
    };
  }

  /**
   * Generate human-readable sync report
   * @returns {string} Formatted report
   */
  async generateSyncReport() {
    const { live, code, hasLive, hasCode } = await this.loadSchemas();

    const lines = ['# Database Schema Sync Report\n'];

    if (!hasLive && !hasCode) {
      lines.push('**No schemas found.**\n');
      lines.push('- Run `/session:project-maps-generate` for code schema');
      lines.push('- Run `/session:project-maps-introspect` for live schema');
      return lines.join('\n');
    }

    // Schema availability
    lines.push('## Schema Sources\n');
    lines.push(`| Source | Available | Tables | Generated |`);
    lines.push(`|--------|-----------|--------|-----------|`);
    lines.push(`| Code (ORM) | ${hasCode ? '✅' : '❌'} | ${code?.tables?.length || 0} | ${code?.generated || '-'} |`);
    lines.push(`| Live (DB) | ${hasLive ? '✅' : '❌'} | ${live?.tables?.length || 0} | ${live?.generated || '-'} |`);
    lines.push('');

    if (!hasLive || !hasCode) {
      lines.push('**Cannot compare** - need both schemas for sync check.\n');
      return lines.join('\n');
    }

    // Compare
    const comparison = this.compareSchemas(live, code);

    // Overall status
    lines.push('## Sync Status\n');
    if (comparison.inSync) {
      lines.push('✅ **IN SYNC** - Database matches code schema\n');
    } else {
      lines.push('⚠️ **DRIFT DETECTED**\n');
      lines.push(`- 🔴 Critical: ${comparison.critical.length}`);
      lines.push(`- 🟡 Warnings: ${comparison.warnings.length}`);
      lines.push(`- 🔵 Info: ${comparison.info.length}`);
      lines.push('');
    }

    // Summary stats
    lines.push('## Summary\n');
    lines.push(`- Tables in both: ${comparison.summary.tablesInBoth}`);
    lines.push(`- Tables only in code: ${comparison.summary.tablesOnlyInCode}`);
    lines.push(`- Tables only in DB: ${comparison.summary.tablesOnlyInDb}`);
    lines.push(`- Columns with drift: ${comparison.summary.columnsWithDrift}`);
    lines.push('');

    // Critical issues
    if (comparison.critical.length > 0) {
      lines.push('## 🔴 Critical Issues (Code Will Break)\n');
      for (const item of comparison.critical) {
        lines.push(`### ${item.table}${item.column ? '.' + item.column : ''}`);
        lines.push(`- **Issue:** ${item.message}`);
        lines.push(`- **Suggestion:** ${item.suggestion}`);
        lines.push('');
      }
    }

    // Warnings
    if (comparison.warnings.length > 0) {
      lines.push('## 🟡 Warnings (May Cause Issues)\n');
      for (const item of comparison.warnings) {
        lines.push(`- **${item.table}${item.column ? '.' + item.column : ''}:** ${item.message}`);
      }
      lines.push('');
    }

    // Info
    if (comparison.info.length > 0) {
      lines.push('## 🔵 Info (Drift Detected)\n');
      for (const item of comparison.info) {
        lines.push(`- **${item.table}${item.column ? '.' + item.column : ''}:** ${item.message}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = {
  DatabaseSchemaSync,
  SEVERITY,
  DRIFT_TYPES,
  areTypesCompatible,
  areTypesExactMatch
};
