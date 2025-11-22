#!/bin/bash

# Backup the original file
cp map-generator.js map-generator.js.backup

# Read the db-schema-methods.js file and extract just the method bodies (skip the header comments and imports)
METHODS=$(sed -n '/^async generateDatabaseSchema/,$p' db-schema-methods.js)

# Find the line number of "module.exports = MapGenerator;"
LINE_NUM=$(grep -n "^module.exports = MapGenerator;" map-generator.js | cut -d: -f1)

# Insert before that line (we need to insert before the closing brace which is one line before)
INSERT_LINE=$((LINE_NUM - 2))

# Split the file and insert the methods
head -n $INSERT_LINE map-generator.js > map-generator.tmp
echo "" >> map-generator.tmp
echo "  /**" >> map-generator.tmp
echo "   * Phase 7 - Task 7-1 & 7-2: Generate database schema map" >> map-generator.tmp
echo "   * Detects ORM, extracts table schemas, columns, types, constraints" >> map-generator.tmp
echo "   */" >> map-generator.tmp
echo "  async generateDatabaseSchema() {" >> map-generator.tmp
echo "    console.log('Detecting database technologies...');" >> map-generator.tmp
echo "" >> map-generator.tmp
echo "    // Task 7-1: Detect ORM and database files" >> map-generator.tmp
echo "    this.dbDetectionResults = await this.dbDetector.detect(this.scanResults.files);" >> map-generator.tmp
echo "" >> map-generator.tmp
echo "    const { orms, schemaFiles, migrationDirs, modelFiles, primary } = this.dbDetectionResults;" >> map-generator.tmp
echo "" >> map-generator.tmp
echo "    console.log(\`Detected \${orms.length} database technologies (primary: \${primary || 'none'})\`);" >> map-generator.tmp
echo "" >> map-generator.tmp
echo "    // Task 7-2 & 7-3: Extract table schemas and relationships" >> map-generator.tmp
echo "    const tables = await this.extractTableSchemas();" >> map-generator.tmp
echo "" >> map-generator.tmp
cat >> map-generator.tmp << 'EOF'
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
EOF
tail -n +$((INSERT_LINE + 1)) map-generator.js >> map-generator.tmp

# Replace the original
mv map-generator.tmp map-generator.js

echo "Phase 7 generateDatabaseSchema method added successfully!"
echo "Backup saved as map-generator.js.backup"
