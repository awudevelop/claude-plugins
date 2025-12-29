# Project Maps Database Introspect Command

Introspect a live PostgreSQL/Supabase database to generate a schema map.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix.
- Correct: `/session:project-maps-introspect`

## Task: Introspect Database

This command connects to a live database using credentials and extracts the actual schema (tables, columns, relationships, indexes, enums).

### Step 1: Parse Arguments and Credentials

The user can provide credentials in several ways:

**Option 1: Connection URL**
```
/session:project-maps-introspect --url "postgres://user:password@host:port/database"
```

**Option 2: Individual Parameters**
```
/session:project-maps-introspect --host db.xxx.supabase.co --port 5432 --database postgres --user postgres --password xxx
```

**Option 3: Environment Variable**
If DATABASE_URL or SUPABASE_DB_URL is set:
```
/session:project-maps-introspect
```

### Step 2: Execute Introspection

Run the CLI command:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps introspect [options]
```

**Available Options:**
- `--url <string>` - PostgreSQL connection URL
- `--host <host>` - Database host
- `--port <port>` - Database port (default: 5432)
- `--database <name>` - Database name
- `--user <user>` - Database username
- `--password <pass>` - Database password
- `--schema <name>` - PostgreSQL schema (default: public)
- `--no-ssl` - Disable SSL (not recommended for production)
- `--output <path>` - Custom output file path

### Step 3: Parse Response

The command returns JSON with:

**Success Response:**
```json
{
  "success": true,
  "outputPath": ".claude/project-maps/database-schema-live.json",
  "database": {
    "type": "PostgreSQL",
    "schema": "public"
  },
  "statistics": {
    "totalTables": 15,
    "totalColumns": 87,
    "totalRelationships": 12,
    "totalIndexes": 23,
    "tablesWithPrimaryKey": 15,
    "tablesWithRelationships": 10
  },
  "introspectionTime": "245ms",
  "message": "Introspected 15 tables with 87 columns in 245ms"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Connection refused",
  "errorCode": "ECONNREFUSED",
  "suggestion": "Check that the database server is running and accessible"
}
```

### Step 4: Display Results

**On Success:**
```
Database Introspection Complete

Summary:
  Tables: {totalTables}
  Columns: {totalColumns}
  Relationships: {totalRelationships}
  Indexes: {totalIndexes}

Output: {outputPath}
Time: {introspectionTime}

Next steps:
  /session:project-maps-query database    View schema details
```

**On Error:**
```
Database introspection failed: {error}

Suggestion: {suggestion}

Common issues:
  - Check host/port are correct and DB is running
  - Verify username/password credentials
  - Ensure user has SELECT access on information_schema
  - For Supabase, use port 5432 for direct or 6543 for pooler
```

## Security Notes

**IMPORTANT:**
- Credentials are NEVER stored in the output file
- Only database type and schema name are recorded
- Use environment variables for production credentials
- Be aware that --password may be visible in shell history

**Recommended approach:**
```bash
export DATABASE_URL="postgres://user:pass@host:port/db"
/session:project-maps-introspect
```

## Supabase Considerations

**Direct Connection (recommended for schema introspection):**
- Port: 5432
- Host: db.xxx.supabase.co
- Faster and more reliable for introspection

**Pooler Connection:**
- Port: 6543
- Host: xxx.pooler.supabase.com
- Use for high-concurrency applications
- Longer timeout configured automatically

## Example Workflows

### Supabase Project
```bash
/session:project-maps-introspect --url "postgres://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres"
```

### Local PostgreSQL
```bash
/session:project-maps-introspect --host localhost --port 5432 --database myapp --user dev --password devpass
```

### Using Environment Variable
```bash
# In your shell or .env
export DATABASE_URL="postgres://user:pass@host:5432/db"

# Then run
/session:project-maps-introspect
```

### Custom Schema
```bash
/session:project-maps-introspect --url "..." --schema my_custom_schema
```

---

ARGUMENTS: {options}
