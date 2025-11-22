const path = require('path');
const fs = require('fs').promises;
const compression = require('./compression');

/**
 * Database Schema Methods for MapGenerator
 *
 * These methods are designed to be used within the MapGenerator class.
 * They can be imported and mixed in, or used as a reference for adding
 * database schema functionality to the project maps system.
 *
 * Usage in MapGenerator:
 * - Add: const DatabaseDetector = require('./db-detector');
 * - In constructor: this.dbDetector = new DatabaseDetector(projectRoot);
 * - Call: await this.generateDatabaseSchema();
 */
class DatabaseSchemaMethods {
  constructor(projectRoot, outputDir, projectHash, scanResults) {
    this.projectRoot = projectRoot;
    this.outputDir = outputDir;
    this.projectHash = projectHash;
    this.scanResults = scanResults;

    // These would be initialized in MapGenerator
    // const DatabaseDetector = require('./db-detector');
    // this.dbDetector = new DatabaseDetector(projectRoot);
  }

  /**
   * Phase 7 - Task 7-1 & 7-2: Generate database schema map
   * Detects ORM, extracts table schemas, columns, types, constraints
   */
  async generateDatabaseSchema() {
    console.log('Detecting database technologies...');

    // Task 7-1: Detect ORM and database files
    this.dbDetectionResults = await this.dbDetector.detect(this.scanResults.files);

    const { orms, schemaFiles, migrationDirs, modelFiles, primary } = this.dbDetectionResults;

    console.log(`Detected ${orms.length} database technologies (primary: ${primary || 'none'})`);

    // Task 7-2 & 7-3: Extract table schemas and relationships
    const tables = await this.extractTableSchemas();

    const databaseSchema = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'database-schema',

      detection: {
        orms: orms.map(orm => ({
          name: orm.name,
          confidence: orm.confidence,
          evidenceCount: orm.evidence.length
        })),
        primaryORM: primary,
        summary: this.dbDetector.getSummary()
      },

      schemaFiles: schemaFiles.map(f => ({
        path: f.path,
        type: f.type,
        orm: f.orm
      })),

      migrationDirectories: migrationDirs.map(dir => ({
        path: dir.path,
        fileCount: dir.fileCount
      })),

      modelFiles: modelFiles.map(f => ({
        path: f.path,
        name: f.name
      })),

      tables: tables,

      statistics: {
        totalTables: tables.length,
        totalColumns: tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0),
        totalRelationships: tables.reduce((sum, t) => sum + (t.relationships?.length || 0), 0),
        totalIndexes: tables.reduce((sum, t) => sum + (t.indexes?.length || 0), 0),
        tablesWithPrimaryKey: tables.filter(t => t.primaryKey).length,
        tablesWithRelationships: tables.filter(t => t.relationships?.length > 0).length
      }
    };

    const outputPath = path.join(this.outputDir, 'database-schema.json');
    const metadata = await compression.compressAndSave(databaseSchema, outputPath);

    console.log(`✓ Generated database-schema.json (${metadata.compressedSize} bytes, ${databaseSchema.tables.length} tables)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 7-2 & 7-3: Extract table schemas from model files
   * Parses model definitions to extract columns, types, constraints, relationships
   */
  async extractTableSchemas() {
    const tables = [];
    const { modelFiles, primary } = this.dbDetectionResults;

    for (const modelFile of modelFiles) {
      try {
        const fullPath = path.join(this.projectRoot, modelFile.path);
        const content = await fs.readFile(fullPath, 'utf8');

        // Extract table schema based on ORM type
        let tableSchema = null;

        if (primary === 'Prisma' && modelFile.path.endsWith('.prisma')) {
          tableSchema = this.parsePrismaSchema(content, modelFile);
        } else if (primary === 'Sequelize' || content.includes('sequelize')) {
          tableSchema = this.parseSequelizeModel(content, modelFile);
        } else if (primary === 'TypeORM' || content.includes('typeorm') || content.includes('@Entity')) {
          tableSchema = this.parseTypeORMEntity(content, modelFile);
        } else if (primary === 'Mongoose' || content.includes('mongoose')) {
          tableSchema = this.parseMongooseSchema(content, modelFile);
        } else if (primary === 'Django ORM' && modelFile.path.endsWith('.py')) {
          tableSchema = this.parseDjangoModel(content, modelFile);
        } else if (primary === 'SQLAlchemy' && modelFile.path.endsWith('.py')) {
          tableSchema = this.parseSQLAlchemyModel(content, modelFile);
        } else if (primary === 'ActiveRecord' && modelFile.path.endsWith('.rb')) {
          tableSchema = this.parseActiveRecordModel(content, modelFile);
        }

        if (tableSchema) {
          if (Array.isArray(tableSchema)) {
            tables.push(...tableSchema);
          } else {
            tables.push(tableSchema);
          }
        }

      } catch (error) {
        // Skip files that fail to parse
        continue;
      }
    }

    return tables;
  }

  /**
   * Parse Prisma schema file
   */
  parsePrismaSchema(content, modelFile) {
    const tables = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(content)) !== null) {
      const [, modelName, body] = match;
      const table = {
        name: modelName,
        tableName: this.toSnakeCase(modelName),
        source: modelFile.path,
        orm: 'Prisma',
        columns: [],
        relationships: [],
        indexes: [],
        primaryKey: null
      };

      // Parse fields
      const fieldRegex = /(\w+)\s+(\w+)(\??|\[\])?(?:\s+@(.+))?/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(body)) !== null) {
        const [, fieldName, fieldType, modifier, decorators] = fieldMatch;

        const column = {
          name: fieldName,
          type: fieldType,
          nullable: modifier === '?',
          isArray: modifier === '[]',
          isPrimary: decorators?.includes('@id'),
          isUnique: decorators?.includes('@unique'),
          hasDefault: decorators?.includes('@default')
        };

        table.columns.push(column);

        if (column.isPrimary) {
          table.primaryKey = fieldName;
        }

        // Detect relationships
        if (!this.isPrimitiveType(fieldType)) {
          const relationType = modifier === '[]' ? 'hasMany' : 'hasOne';
          table.relationships.push({
            type: relationType,
            targetTable: fieldType,
            foreignKey: fieldName
          });
        }

        // Extract indexes from decorators
        if (decorators?.includes('@index')) {
          table.indexes.push({
            columns: [fieldName],
            type: 'index'
          });
        }
      }

      // Parse model-level indexes
      const indexRegex = /@@index\(\[([^\]]+)\]/g;
      let indexMatch;
      while ((indexMatch = indexRegex.exec(body)) !== null) {
        const columns = indexMatch[1].split(',').map(c => c.trim());
        table.indexes.push({
          columns,
          type: 'compound-index'
        });
      }

      tables.push(table);
    }

    return tables;
  }

  /**
   * Parse Sequelize model
   */
  parseSequelizeModel(content, modelFile) {
    const table = {
      name: path.basename(modelFile.name, path.extname(modelFile.name)),
      tableName: null,
      source: modelFile.path,
      orm: 'Sequelize',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };

    // Extract table name from sequelize.define
    const defineMatch = content.match(/sequelize\.define\(['"](\w+)['"]/i);
    if (defineMatch) {
      table.tableName = defineMatch[1];
    }

    // Extract columns from define second argument
    const defineBodyMatch = content.match(/sequelize\.define\([^,]+,\s*\{([^}]+)\}/s);
    if (defineBodyMatch) {
      const body = defineBodyMatch[1];

      // Parse field definitions
      const fieldRegex = /(\w+):\s*\{[^}]*type:\s*DataTypes\.(\w+)/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(body)) !== null) {
        const [, fieldName, fieldType] = fieldMatch;

        table.columns.push({
          name: fieldName,
          type: fieldType,
          nullable: !body.includes(`${fieldName}:`) || !body.includes('allowNull: false')
        });
      }
    }

    // Extract associations
    if (content.includes('hasMany')) {
      const hasManyRegex = /hasMany\(models\.(\w+)/g;
      let match;
      while ((match = hasManyRegex.exec(content)) !== null) {
        table.relationships.push({
          type: 'hasMany',
          targetTable: match[1],
          foreignKey: null
        });
      }
    }

    if (content.includes('belongsTo')) {
      const belongsToRegex = /belongsTo\(models\.(\w+)/g;
      let match;
      while ((match = belongsToRegex.exec(content)) !== null) {
        table.relationships.push({
          type: 'belongsTo',
          targetTable: match[1],
          foreignKey: null
        });
      }
    }

    return table.columns.length > 0 ? table : null;
  }

  /**
   * Parse TypeORM entity
   */
  parseTypeORMEntity(content, modelFile) {
    const entityMatch = content.match(/@Entity\(['"]?(\w+)?['"]?\)\s*(?:export\s+)?class\s+(\w+)/);
    if (!entityMatch) return null;

    const [, tableName, className] = entityMatch;
    const table = {
      name: className,
      tableName: tableName || this.toSnakeCase(className),
      source: modelFile.path,
      orm: 'TypeORM',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: null
    };

    // Extract columns
    const columnRegex = /@Column\(([^)]*)\)\s+(\w+):\s*(\w+)/g;
    let match;

    while ((match = columnRegex.exec(content)) !== null) {
      const [, options, fieldName, fieldType] = match;

      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: options.includes('nullable: true')
      });
    }

    // Extract primary key
    const pkMatch = content.match(/@PrimaryGeneratedColumn\(\)\s+(\w+):/);
    if (pkMatch) {
      table.primaryKey = pkMatch[1];
      table.columns.push({
        name: pkMatch[1],
        type: 'number',
        isPrimary: true,
        nullable: false
      });
    }

    // Extract relationships
    const relationRegex = /@(OneToMany|ManyToOne|OneToOne|ManyToMany)\(\(\)\s*=>\s*(\w+)/g;
    let relMatch;

    while ((relMatch = relationRegex.exec(content)) !== null) {
      const [, relationType, targetEntity] = relMatch;

      table.relationships.push({
        type: relationType,
        targetTable: targetEntity,
        foreignKey: null
      });
    }

    // Extract indexes
    const indexRegex = /@Index\(\[['"](\w+)['"]\]\)/g;
    let indexMatch;

    while ((indexMatch = indexRegex.exec(content)) !== null) {
      table.indexes.push({
        columns: [indexMatch[1]],
        type: 'index'
      });
    }

    return table;
  }

  /**
   * Parse Mongoose schema
   */
  parseMongooseSchema(content, modelFile) {
    const schemaMatch = content.match(/new\s+(?:mongoose\.)?Schema\(\{([^}]+)\}/s);
    if (!schemaMatch) return null;

    const modelNameMatch = content.match(/model\(['"](\w+)['"]/);
    const modelName = modelNameMatch ? modelNameMatch[1] : path.basename(modelFile.name, path.extname(modelFile.name));

    const table = {
      name: modelName,
      tableName: modelName.toLowerCase(),
      source: modelFile.path,
      orm: 'Mongoose',
      database: 'MongoDB',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: '_id'
    };

    const body = schemaMatch[1];

    // Parse fields
    const fieldRegex = /(\w+):\s*\{[^}]*type:\s*(\w+)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const [, fieldName, fieldType] = fieldMatch;

      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: true
      });
    }

    // Extract references (relationships)
    const refRegex = /(\w+):\s*\{[^}]*ref:\s*['"](\w+)['"]/g;
    let refMatch;

    while ((refMatch = refRegex.exec(body)) !== null) {
      table.relationships.push({
        type: 'ref',
        targetTable: refMatch[2],
        foreignKey: refMatch[1]
      });
    }

    return table;
  }

  /**
   * Parse Django model
   */
  parseDjangoModel(content, modelFile) {
    const classMatch = content.match(/class\s+(\w+)\(models\.Model\)/);
    if (!classMatch) return null;

    const className = classMatch[1];
    const table = {
      name: className,
      tableName: this.toSnakeCase(className),
      source: modelFile.path,
      orm: 'Django ORM',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };

    // Extract fields
    const fieldRegex = /(\w+)\s*=\s*models\.(\w+Field)/g;
    let match;

    while ((match = fieldRegex.exec(content)) !== null) {
      const [, fieldName, fieldType] = match;

      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: false
      });
    }

    // Extract foreign keys
    const fkRegex = /(\w+)\s*=\s*models\.ForeignKey\(['"]?(\w+)['"]?/g;
    let fkMatch;

    while ((fkMatch = fkRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'ForeignKey',
        targetTable: fkMatch[2],
        foreignKey: fkMatch[1]
      });
    }

    return table;
  }

  /**
   * Parse SQLAlchemy model
   */
  parseSQLAlchemyModel(content, modelFile) {
    const classMatch = content.match(/class\s+(\w+)\(.*Base.*\)/);
    if (!classMatch) return null;

    const className = classMatch[1];
    const tableNameMatch = content.match(/__tablename__\s*=\s*['"](\w+)['"]/);

    const table = {
      name: className,
      tableName: tableNameMatch ? tableNameMatch[1] : this.toSnakeCase(className),
      source: modelFile.path,
      orm: 'SQLAlchemy',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };

    // Extract columns
    const columnRegex = /(\w+)\s*=\s*Column\((\w+)/g;
    let match;

    while ((match = columnRegex.exec(content)) !== null) {
      const [, fieldName, fieldType] = match;

      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: false
      });
    }

    // Extract relationships
    const relRegex = /(\w+)\s*=\s*relationship\(['"](\w+)['"]/g;
    let relMatch;

    while ((relMatch = relRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'relationship',
        targetTable: relMatch[2],
        foreignKey: relMatch[1]
      });
    }

    return table;
  }

  /**
   * Parse ActiveRecord model (Rails)
   */
  parseActiveRecordModel(content, modelFile) {
    const classMatch = content.match(/class\s+(\w+)\s*<\s*ApplicationRecord/);
    if (!classMatch) return null;

    const className = classMatch[1];
    const table = {
      name: className,
      tableName: this.toSnakeCase(className) + 's',
      source: modelFile.path,
      orm: 'ActiveRecord',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };

    // Extract associations
    const hasManyRegex = /has_many\s+:(\w+)/g;
    let match;

    while ((match = hasManyRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'has_many',
        targetTable: match[1],
        foreignKey: null
      });
    }

    const belongsToRegex = /belongs_to\s+:(\w+)/g;
    while ((match = belongsToRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'belongs_to',
        targetTable: match[1],
        foreignKey: `${match[1]}_id`
      });
    }

    return table;
  }

  /**
   * Task 7-4: Generate table-to-module mapping
   * Shows which modules use which tables
   */
  async generateTableModuleMapping() {
    console.log('Generating table-to-module mapping...');

    // Load modules data to get tablesUsed from Phase 4
    const modulesPath = path.join(this.outputDir, 'modules.json');
    let modulesData = null;

    try {
      modulesData = await compression.loadAndDecompress(modulesPath);
    } catch (error) {
      console.log('⚠ modules.json not found, skipping table-to-module mapping');
      return null;
    }

    // Build table-to-modules mapping
    const tablesToModules = {};
    const modulesToTables = {};

    for (const [moduleName, moduleData] of Object.entries(modulesData.modules)) {
      if (moduleData.tablesUsed && moduleData.tablesUsed.length > 0) {
        modulesToTables[moduleName] = moduleData.tablesUsed;

        for (const tableName of moduleData.tablesUsed) {
          if (!tablesToModules[tableName]) {
            tablesToModules[tableName] = [];
          }
          tablesToModules[tableName].push(moduleName);
        }
      }
    }

    const mapping = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'table-module-mapping',

      tablesToModules: tablesToModules,
      modulesToTables: modulesToTables,

      statistics: {
        totalTables: Object.keys(tablesToModules).length,
        totalModules: Object.keys(modulesToTables).length,
        averageTablesPerModule: Object.keys(modulesToTables).length > 0
          ? (Object.values(modulesToTables).reduce((sum, tables) => sum + tables.length, 0) / Object.keys(modulesToTables).length).toFixed(2)
          : 0,
        averageModulesPerTable: Object.keys(tablesToModules).length > 0
          ? (Object.values(tablesToModules).reduce((sum, modules) => sum + modules.length, 0) / Object.keys(tablesToModules).length).toFixed(2)
          : 0,
        sharedTables: Object.values(tablesToModules).filter(modules => modules.length > 1).length
      }
    };

    const outputPath = path.join(this.outputDir, 'table-module-mapping.json');
    const metadata = await compression.compressAndSave(mapping, outputPath);

    console.log(`✓ Generated table-module-mapping.json (${metadata.compressedSize} bytes, ${mapping.statistics.totalTables} tables)`);

    return { file: outputPath, metadata };
  }

  /**
   * Helper: Check if type is a primitive Prisma type
   */
  isPrimitiveType(type) {
    const primitiveTypes = [
      'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
      'DateTime', 'Json', 'Bytes'
    ];
    return primitiveTypes.includes(type);
  }

  /**
   * Helper: Convert PascalCase to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}

module.exports = DatabaseSchemaMethods;
