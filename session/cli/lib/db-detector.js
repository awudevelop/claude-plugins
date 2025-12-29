const fs = require('fs').promises;
const path = require('path');

/**
 * Database ORM/Framework Detector for project context maps
 * Detects database technologies, schema files, and model definitions
 *
 * Supported ORMs/Frameworks:
 * - Sequelize (Node.js)
 * - Prisma (Node.js)
 * - TypeORM (Node.js/TypeScript)
 * - Mongoose (MongoDB/Node.js)
 * - Knex.js (SQL query builder)
 * - SQLAlchemy (Python)
 * - Django ORM (Python)
 * - ActiveRecord (Ruby/Rails)
 * - Schemock (Schema-first mocking framework)
 */

class DatabaseDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.detectedORMs = [];
    this.schemaFiles = [];
    this.migrationDirs = [];
    this.modelFiles = [];
    this.seedFiles = [];
  }

  /**
   * Main detection method - analyzes project for database technologies
   * @param {Array} scannedFiles - Array of file metadata from scanner
   * @returns {Object} Database detection results
   */
  async detect(scannedFiles) {
    this.detectedORMs = [];
    this.schemaFiles = [];
    this.migrationDirs = [];
    this.modelFiles = [];
    this.seedFiles = [];

    // Detect by file patterns
    await this.detectByFiles(scannedFiles);

    // Detect by package.json dependencies
    await this.detectByPackageJson(scannedFiles);

    // Detect by requirements.txt (Python)
    await this.detectByRequirements(scannedFiles);

    // Detect by Gemfile (Ruby)
    await this.detectByGemfile(scannedFiles);

    // Analyze migration directories
    this.detectMigrationDirs(scannedFiles);

    // Analyze model files
    this.detectModelFiles(scannedFiles);

    // Analyze seed files
    this.detectSeedFiles(scannedFiles);

    return {
      orms: this.detectedORMs,
      schemaFiles: this.schemaFiles,
      migrationDirs: this.migrationDirs,
      modelFiles: this.modelFiles,
      seedFiles: this.seedFiles,
      primary: this.getPrimaryORM()
    };
  }

  /**
   * Detect database technologies by file patterns
   */
  async detectByFiles(scannedFiles) {
    for (const file of scannedFiles) {
      const fileName = file.name.toLowerCase();
      const relativePath = file.relativePath.toLowerCase();

      // Prisma
      if (fileName === 'schema.prisma' || fileName.endsWith('.prisma')) {
        this.addORM('Prisma', 'file', file.relativePath);
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'prisma',
          orm: 'Prisma'
        });
      }

      // Sequelize
      if (fileName === '.sequelizerc' ||
          fileName === 'sequelize.config.js' ||
          fileName === 'sequelize.config.ts' ||
          relativePath.includes('/models/index.js') && this.isProbablySequelize(file.path)) {
        this.addORM('Sequelize', 'file', file.relativePath);
      }

      // TypeORM
      if (fileName === 'ormconfig.json' ||
          fileName === 'ormconfig.js' ||
          fileName === 'ormconfig.ts' ||
          fileName === 'typeorm.config.ts') {
        this.addORM('TypeORM', 'file', file.relativePath);
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'typeorm-config',
          orm: 'TypeORM'
        });
      }

      // Mongoose
      if (fileName.includes('mongoose') && fileName.includes('config')) {
        this.addORM('Mongoose', 'file', file.relativePath);
      }

      // Knex.js
      if (fileName === 'knexfile.js' ||
          fileName === 'knexfile.ts' ||
          fileName === 'knex.config.js') {
        this.addORM('Knex.js', 'file', file.relativePath);
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'knex-config',
          orm: 'Knex.js'
        });
      }

      // Django
      if (fileName === 'manage.py' ||
          (fileName === 'settings.py' && relativePath.includes('/settings/'))) {
        this.addORM('Django ORM', 'file', file.relativePath);
      }

      // SQLAlchemy
      if (fileName.includes('sqlalchemy') ||
          (fileName === 'models.py' && this.isProbablySQLAlchemy(file.path))) {
        this.addORM('SQLAlchemy', 'file', file.relativePath);
      }

      // Rails ActiveRecord
      if (fileName === 'database.yml' && relativePath.includes('/config/')) {
        this.addORM('ActiveRecord', 'file', file.relativePath);
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'rails-database-config',
          orm: 'ActiveRecord'
        });
      }

      if (fileName === 'schema.rb' && relativePath.includes('/db/')) {
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'rails-schema',
          orm: 'ActiveRecord'
        });
      }

      // Generic SQL files
      if (fileName.endsWith('.sql')) {
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'sql',
          orm: 'Unknown'
        });
      }

      // Schemock
      if (fileName === 'schemock.config.ts' ||
          fileName === 'schemock.config.js' ||
          fileName === 'schemock.config.mjs') {
        this.addORM('Schemock', 'file', file.relativePath);
        this.schemaFiles.push({
          path: file.relativePath,
          type: 'schemock-config',
          orm: 'Schemock'
        });
      }
    }
  }

  /**
   * Detect database technologies by package.json
   */
  async detectByPackageJson(scannedFiles) {
    const packageJsonFiles = scannedFiles.filter(f => f.name === 'package.json');

    for (const file of packageJsonFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        const packageJson = JSON.parse(content);
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        if (allDeps['prisma'] || allDeps['@prisma/client']) {
          this.addORM('Prisma', 'dependency', file.relativePath);
        }

        if (allDeps['sequelize']) {
          this.addORM('Sequelize', 'dependency', file.relativePath);
        }

        if (allDeps['typeorm']) {
          this.addORM('TypeORM', 'dependency', file.relativePath);
        }

        if (allDeps['mongoose']) {
          this.addORM('Mongoose', 'dependency', file.relativePath);
        }

        if (allDeps['knex']) {
          this.addORM('Knex.js', 'dependency', file.relativePath);
        }

        if (allDeps['pg'] || allDeps['pg-promise']) {
          this.addORM('PostgreSQL (raw)', 'dependency', file.relativePath);
        }

        if (allDeps['mysql'] || allDeps['mysql2']) {
          this.addORM('MySQL (raw)', 'dependency', file.relativePath);
        }

        if (allDeps['sqlite3'] || allDeps['better-sqlite3']) {
          this.addORM('SQLite', 'dependency', file.relativePath);
        }

        if (allDeps['schemock']) {
          this.addORM('Schemock', 'dependency', file.relativePath);
        }

      } catch (error) {
        // Skip files that can't be parsed
        continue;
      }
    }
  }

  /**
   * Detect database technologies by requirements.txt (Python)
   */
  async detectByRequirements(scannedFiles) {
    const requirementsFiles = scannedFiles.filter(f =>
      f.name === 'requirements.txt' ||
      f.name === 'requirements.in' ||
      f.name === 'Pipfile'
    );

    for (const file of requirementsFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        const lines = content.toLowerCase();

        if (lines.includes('django')) {
          this.addORM('Django ORM', 'dependency', file.relativePath);
        }

        if (lines.includes('sqlalchemy')) {
          this.addORM('SQLAlchemy', 'dependency', file.relativePath);
        }

        if (lines.includes('psycopg2') || lines.includes('psycopg3')) {
          this.addORM('PostgreSQL (raw)', 'dependency', file.relativePath);
        }

        if (lines.includes('pymongo')) {
          this.addORM('PyMongo', 'dependency', file.relativePath);
        }

      } catch (error) {
        continue;
      }
    }
  }

  /**
   * Detect database technologies by Gemfile (Ruby)
   */
  async detectByGemfile(scannedFiles) {
    const gemfiles = scannedFiles.filter(f => f.name === 'Gemfile');

    for (const file of gemfiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        const lines = content.toLowerCase();

        if (lines.includes('rails')) {
          this.addORM('ActiveRecord', 'dependency', file.relativePath);
        }

        if (lines.includes('activerecord')) {
          this.addORM('ActiveRecord', 'dependency', file.relativePath);
        }

      } catch (error) {
        continue;
      }
    }
  }

  /**
   * Detect migration directories
   */
  detectMigrationDirs(scannedFiles) {
    const migrationFiles = scannedFiles.filter(f => {
      const relativePath = f.relativePath.toLowerCase();
      return relativePath.includes('/migrations/') ||
             relativePath.includes('/migrate/') ||
             (relativePath.includes('/db/') && f.name.match(/^\d+.*\.(js|ts|py|rb|sql)$/));
    });

    // Group by directory
    const dirs = new Set();
    for (const file of migrationFiles) {
      const dir = path.dirname(file.relativePath);
      dirs.add(dir);
    }

    this.migrationDirs = Array.from(dirs).map(dir => ({
      path: dir,
      fileCount: migrationFiles.filter(f => path.dirname(f.relativePath) === dir).length,
      files: migrationFiles
        .filter(f => path.dirname(f.relativePath) === dir)
        .map(f => f.relativePath)
    }));
  }

  /**
   * Detect model files
   */
  detectModelFiles(scannedFiles) {
    const modelFiles = scannedFiles.filter(f => {
      const relativePath = f.relativePath.toLowerCase();
      const fileName = f.name.toLowerCase();

      return (
        relativePath.includes('/models/') ||
        relativePath.includes('/entities/') ||
        relativePath.includes('/schemas/') || // Schemock schema files
        fileName.endsWith('.model.js') ||
        fileName.endsWith('.model.ts') ||
        fileName.endsWith('.entity.js') ||
        fileName.endsWith('.entity.ts') ||
        fileName.endsWith('.schema.js') ||
        fileName.endsWith('.schema.ts')
      );
    });

    this.modelFiles = modelFiles.map(f => ({
      path: f.relativePath,
      name: f.name,
      type: f.type,
      size: f.size,
      lines: f.lines
    }));
  }

  /**
   * Detect seed files
   */
  detectSeedFiles(scannedFiles) {
    const seedFiles = scannedFiles.filter(f => {
      const relativePath = f.relativePath.toLowerCase();
      const fileName = f.name.toLowerCase();

      return (
        relativePath.includes('/seeds/') ||
        relativePath.includes('/seeders/') ||
        fileName.includes('seed') ||
        fileName.includes('fixture')
      );
    });

    this.seedFiles = seedFiles.map(f => ({
      path: f.relativePath,
      name: f.name
    }));
  }

  /**
   * Add ORM to detected list (avoid duplicates)
   */
  addORM(name, detectionMethod, evidence) {
    const existing = this.detectedORMs.find(orm => orm.name === name);
    if (existing) {
      existing.evidence.push({ method: detectionMethod, file: evidence });
    } else {
      this.detectedORMs.push({
        name,
        detectionMethod,
        evidence: [{ method: detectionMethod, file: evidence }],
        confidence: this.calculateConfidence(name, detectionMethod)
      });
    }
  }

  /**
   * Calculate confidence level for ORM detection
   */
  calculateConfidence(name, method) {
    if (method === 'file' && name === 'Prisma') return 'high';
    if (method === 'file' && name === 'Schemock') return 'high'; // Config file is definitive
    if (method === 'file') return 'medium';
    if (method === 'dependency') return 'medium';
    return 'low';
  }

  /**
   * Get primary ORM (highest confidence)
   */
  getPrimaryORM() {
    if (this.detectedORMs.length === 0) return null;

    // Sort by confidence and evidence count
    const sorted = this.detectedORMs.sort((a, b) => {
      const confidenceScore = { high: 3, medium: 2, low: 1 };
      const aScore = confidenceScore[a.confidence] * a.evidence.length;
      const bScore = confidenceScore[b.confidence] * b.evidence.length;
      return bScore - aScore;
    });

    return sorted[0].name;
  }

  /**
   * Check if file is probably a Sequelize model
   */
  async isProbablySequelize(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.includes('Sequelize') || content.includes('sequelize');
    } catch {
      return false;
    }
  }

  /**
   * Check if file is probably SQLAlchemy
   */
  async isProbablySQLAlchemy(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.includes('SQLAlchemy') ||
             content.includes('from sqlalchemy') ||
             content.includes('import sqlalchemy');
    } catch {
      return false;
    }
  }

  /**
   * Get detection summary
   */
  getSummary() {
    return {
      totalORMs: this.detectedORMs.length,
      primaryORM: this.getPrimaryORM(),
      hasSchemaFiles: this.schemaFiles.length > 0,
      hasMigrations: this.migrationDirs.length > 0,
      hasModels: this.modelFiles.length > 0,
      hasSeeds: this.seedFiles.length > 0,
      modelFileCount: this.modelFiles.length,
      migrationFileCount: this.migrationDirs.reduce((sum, dir) => sum + dir.fileCount, 0),
      schemaFileCount: this.schemaFiles.length
    };
  }
}

module.exports = DatabaseDetector;
