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
        } else if (primary === 'Schemock' ||
                   content.includes('defineData') ||
                   content.includes("from 'schemock") ||
                   content.includes('from "schemock')) {
          tableSchema = this.parseSchemockSchema(content, modelFile);
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
   * Parse Schemock schema definitions
   *
   * Schemock uses a DSL with defineData():
   *   const Entity = defineData('entity', {
   *     id: field.uuid(),
   *     name: field.string(),
   *     email: field.email().unique(),
   *     posts: hasMany('post', { foreignKey: 'author_id' })
   *   }, { timestamps: true });
   */
  parseSchemockSchema(content, modelFile) {
    const tables = [];

    // Check if this is a schemock file
    if (!content.includes('defineData') && !content.includes('schemock')) {
      return null;
    }

    // Match each defineData block
    // Pattern: export const VarName = defineData('entityName', ...
    const defineDataPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*defineData\s*\(\s*['"](\w+)['"]/g;
    let entityMatch;
    const entities = [];

    while ((entityMatch = defineDataPattern.exec(content)) !== null) {
      entities.push({
        varName: entityMatch[1],
        entityName: entityMatch[2],
        startIndex: entityMatch.index
      });
    }

    for (const entity of entities) {
      // Extract the block for this entity (from defineData to matching closing paren)
      const startIdx = entity.startIndex;
      let parenCount = 0;
      let inBlock = false;
      let endIdx = startIdx;

      for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '(') {
          if (!inBlock) inBlock = true;
          parenCount++;
        } else if (content[i] === ')') {
          parenCount--;
          if (inBlock && parenCount === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }

      const entityBlock = content.substring(startIdx, endIdx);

      const table = {
        name: entity.varName, // PascalCase export name
        tableName: entity.entityName, // snake_case entity name
        source: modelFile.path,
        orm: 'Schemock',
        columns: [],
        relationships: [],
        indexes: [],
        primaryKey: null
      };

      // Parse field definitions using a more robust approach
      // Handles: field.type(), field.category.method(), field.type().modifier()
      const fields = this.parseSchemockFields(entityBlock);

      for (const fieldDef of fields) {
        const column = this.convertSchemockFieldToColumn(fieldDef);
        if (column) {
          table.columns.push(column);
          if (column.isPrimary) {
            table.primaryKey = column.name;
          }
        }
      }

      // Parse relationships: hasMany, belongsTo, hasOne
      const relationshipRegex = /(\w+)\s*:\s*(hasMany|belongsTo|hasOne)\s*\(\s*['"](\w+)['"](?:\s*,\s*\{([^}]*)\})?\)/g;
      let relMatch;

      while ((relMatch = relationshipRegex.exec(entityBlock)) !== null) {
        const [, relName, relType, targetEntity, options] = relMatch;

        let foreignKey = null;
        if (options) {
          const fkMatch = options.match(/foreignKey\s*:\s*['"](\w+)['"]/);
          if (fkMatch) foreignKey = fkMatch[1];
        }

        table.relationships.push({
          name: relName,
          type: relType,
          targetTable: targetEntity.charAt(0).toUpperCase() + targetEntity.slice(1),
          foreignKey: foreignKey
        });
      }

      // Check for timestamps option
      if (entityBlock.includes('timestamps: true') || entityBlock.includes('timestamps:true')) {
        table.columns.push(
          { name: 'created_at', type: 'DateTime', nullable: false, hasDefault: true },
          { name: 'updated_at', type: 'DateTime', nullable: false, hasDefault: true }
        );
      }

      if (table.columns.length > 0) {
        tables.push(table);
      }
    }

    return tables.length > 0 ? tables : null;
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
   * Parse schemock field definitions from an entity block
   * Returns array of field objects with name, type info, and modifiers
   */
  parseSchemockFields(entityBlock) {
    const fields = [];

    // Split block into lines and find field definitions
    // Match: fieldName: field.something
    const lines = entityBlock.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines, comments, relationships
      if (!line || line.startsWith('//') || line.startsWith('/*')) continue;
      if (line.includes('hasMany(') || line.includes('belongsTo(') || line.includes('hasOne(')) continue;

      // Match field definition start: fieldName: field.
      const fieldStartMatch = line.match(/^(\w+)\s*:\s*field\./);
      if (!fieldStartMatch) continue;

      const fieldName = fieldStartMatch[1];

      // Extract the full field expression (may span multiple lines for objects)
      let fullExpression = line.substring(line.indexOf('field.'));

      // Handle multi-line object definitions
      if (fullExpression.includes('field.object(') && !this.isBalanced(fullExpression, '(', ')')) {
        // Collect lines until balanced
        let j = i + 1;
        while (j < lines.length && !this.isBalanced(fullExpression, '(', ')')) {
          fullExpression += '\n' + lines[j].trim();
          j++;
        }
      }

      // Remove trailing comma
      fullExpression = fullExpression.replace(/,\s*$/, '');

      // Parse the field expression
      const fieldDef = this.parseSchemockFieldExpression(fieldName, fullExpression);
      if (fieldDef) {
        fields.push(fieldDef);
      }
    }

    return fields;
  }

  /**
   * Parse a single schemock field expression
   * e.g., "field.uuid()", "field.person.fullName().nullable()", "field.enum(['a','b']).default('a')"
   */
  parseSchemockFieldExpression(fieldName, expression) {
    // Pattern: field.type() or field.category.method()
    // followed by optional modifiers: .nullable(), .unique(), .default(...)

    const result = {
      name: fieldName,
      baseType: null,
      category: null,
      method: null,
      args: null,
      modifiers: {
        nullable: false,
        unique: false,
        hasDefault: false,
        defaultValue: null
      }
    };

    // Extract base type/category/method
    // field.uuid() -> baseType: uuid
    // field.person.fullName() -> category: person, method: fullName
    // field.enum(['a', 'b']) -> baseType: enum, args: ['a', 'b']

    const baseMatch = expression.match(/^field\.(\w+)(?:\.(\w+))?\s*\(/);
    if (!baseMatch) return null;

    const [, first, second] = baseMatch;

    // Determine if it's type or category.method
    const simpleTypes = ['uuid', 'string', 'number', 'boolean', 'date', 'email', 'url', 'enum', 'ref', 'array', 'object'];

    if (simpleTypes.includes(first)) {
      result.baseType = first;
    } else {
      // It's a category like 'person', 'company', 'lorem'
      result.category = first;
      result.method = second;
    }

    // Extract arguments from the first parentheses
    const argsStart = expression.indexOf('(');
    if (argsStart !== -1) {
      const argsEnd = this.findMatchingParen(expression, argsStart);
      if (argsEnd !== -1) {
        result.args = expression.substring(argsStart + 1, argsEnd);
      }
    }

    // Check for modifiers
    result.modifiers.nullable = expression.includes('.nullable()');
    result.modifiers.unique = expression.includes('.unique()');
    result.modifiers.hasDefault = expression.includes('.default(');

    // Extract default value
    const defaultMatch = expression.match(/\.default\(([^)]+)\)/);
    if (defaultMatch) {
      result.modifiers.defaultValue = defaultMatch[1].trim();
    }

    return result;
  }

  /**
   * Convert parsed schemock field to column schema
   */
  convertSchemockFieldToColumn(fieldDef) {
    // Map schemock types to SQL-like types
    const typeMap = {
      // Simple types
      'uuid': 'UUID',
      'string': 'String',
      'number': 'Number',
      'boolean': 'Boolean',
      'date': 'DateTime',
      'email': 'String',
      'url': 'String',
      'enum': 'Enum',
      'ref': 'Reference',
      'array': 'Array',
      'object': 'JSON',
      // Semantic types (faker categories) - map to base types
      'person': 'String',
      'company': 'String',
      'lorem': 'String',
      'internet': 'String',
      'image': 'String',
      'commerce': 'Number',
      'finance': 'Number'
    };

    // Determine the SQL type
    let sqlType = 'String';
    if (fieldDef.baseType) {
      sqlType = typeMap[fieldDef.baseType] || 'String';
    } else if (fieldDef.category) {
      sqlType = typeMap[fieldDef.category] || 'String';
    }

    const column = {
      name: fieldDef.name,
      type: sqlType,
      nullable: fieldDef.modifiers.nullable,
      isPrimary: fieldDef.name === 'id' && fieldDef.baseType === 'uuid',
      isUnique: fieldDef.modifiers.unique,
      hasDefault: fieldDef.modifiers.hasDefault,
      isArray: fieldDef.baseType === 'array'
    };

    // Extract enum values
    if (fieldDef.baseType === 'enum' && fieldDef.args) {
      const enumMatch = fieldDef.args.match(/\[([^\]]+)\]/);
      if (enumMatch) {
        column.enumValues = enumMatch[1]
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''));
      }
    }

    // Extract reference target
    if (fieldDef.baseType === 'ref' && fieldDef.args) {
      const refMatch = fieldDef.args.match(/['"](\w+)['"]/);
      if (refMatch) {
        column.references = refMatch[1];
      }
    }

    return column;
  }

  /**
   * Find matching closing parenthesis
   */
  findMatchingParen(str, start) {
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Check if parentheses are balanced
   */
  isBalanced(str, open, close) {
    let count = 0;
    for (const char of str) {
      if (char === open) count++;
      else if (char === close) count--;
    }
    return count === 0;
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
