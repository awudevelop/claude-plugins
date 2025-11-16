# DevOps Plugin - View Logs

You are retrieving and displaying deployment, build, or application logs.

## Task: View Logs

The user wants to view logs from deployments, builds, or running applications.

### Step 1: Verify Configuration

1. Check if `.devops/config.json` exists
2. Read configuration to determine platform
3. **Validate platform is supported**:
   - If platform is NOT "netlify", show error:
   ```
   ❌ Platform Not Supported: {platform}

   This plugin currently supports Netlify only.

   To switch to Netlify: /devops:init

   Supported platforms: Netlify
   ```
   Then STOP.

### Step 2: Parse Logs Command

Parse arguments:
- `/devops:logs` - Show recent application logs (last 100 lines)
- `/devops:logs --lines 500` - Show last N lines
- `/devops:logs --build {build_id}` - Show build logs
- `/devops:logs --deployment {deployment_id}` - Show deployment logs
- `/devops:logs --follow` - Stream logs in real-time
- `/devops:logs --error` - Show only errors
- `/devops:logs --since 1h` - Show logs from last hour

### Step 3: Fetch Application Logs

**For `/devops:logs`** (default):

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs fetch \
  --type application \
  --lines {lines} \
  --format pretty
```

Display:
```
📝 Application Logs (last {lines} lines)

Platform: {platform}
Environment: {environment}
Time range: {start_time} to {end_time}

─────────────────────────────────────────
{timestamp} [INFO]  Application started on port 3000
{timestamp} [INFO]  Connected to database
{timestamp} [DEBUG] Processing request: GET /api/users
{timestamp} [INFO]  Response sent: 200 OK
{timestamp} [WARN]  High memory usage: 85%
{timestamp} [ERROR] Database query timeout
{timestamp} [INFO]  Retry successful
─────────────────────────────────────────

Total: {total_lines} lines
Errors: {error_count}
Warnings: {warning_count}

💡 Filter errors: /devops:logs --error
💡 Stream live: /devops:logs --follow
```

### Step 4: Fetch Build Logs

**For `/devops:logs --build {build_id}`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs fetch \
  --type build \
  --id {build_id}
```

Display:
```
🔨 Build Logs

Build ID: {build_id}
Status: {status}
Branch: {branch}
Duration: {duration}

─────────────────────────────────────────
[00:00] Starting build...
[00:02] Installing dependencies...
[00:15] Running npm install...
[00:45] Dependencies installed (245 packages)
[00:46] Running build script...
[01:20] Compiling TypeScript...
[01:55] Build completed successfully
[01:56] Generating artifacts...
[02:00] Build finished
─────────────────────────────────────────

Build artifacts:
- app.zip (15.2 MB)
- source-map.json (324 KB)

Exit code: 0
```

### Step 5: Fetch Deployment Logs

**For `/devops:logs --deployment {deployment_id}`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs fetch \
  --type deployment \
  --id {deployment_id}
```

Display:
```
🚀 Deployment Logs

Deployment ID: {deployment_id}
Version: {version}
Environment: {environment}
Status: {status}

─────────────────────────────────────────
[00:00] Starting deployment...
[00:01] Validating configuration...
[00:02] Uploading artifacts...
[00:15] Artifacts uploaded (15.2 MB)
[00:16] Provisioning resources...
[00:30] Starting application...
[00:45] Health check: passed
[00:46] Deployment complete
─────────────────────────────────────────

URL: {deployment_url}
Duration: {duration}
```

### Step 6: Stream Logs (Follow Mode)

**For `/devops:logs --follow`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs stream
```

Show:
```
📡 Streaming logs (Ctrl+C to stop)...

{timestamp} [INFO]  Incoming request: GET /api/data
{timestamp} [INFO]  Database query executed
{timestamp} [INFO]  Response sent: 200 OK
{timestamp} [INFO]  Request completed in 45ms
{timestamp} [WARN]  Cache miss for key: user_123
{timestamp} [INFO]  Cache refreshed
... (continues streaming)
```

Note: In Claude Code, we can't truly stream indefinitely, so:
1. Stream for 30 seconds
2. Ask: "Continue streaming?"
   - If yes, stream another 30 seconds
   - If no, STOP

### Step 7: Filter Logs

**For `/devops:logs --error`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs fetch \
  --filter error \
  --lines 100
```

Display:
```
❌ Error Logs (last 100 errors)

{timestamp} [ERROR] Database connection lost
  Stack trace:
    at DatabaseManager.connect (db.js:45)
    at Server.start (server.js:20)

{timestamp} [ERROR] Unhandled promise rejection
  Error: Timeout waiting for response
    at fetch (api.js:102)

{timestamp} [ERROR] Memory limit exceeded
  Current: 512 MB / Limit: 512 MB

Total errors: {error_count}
Most common: {most_common_error} ({count} occurrences)

💡 View full context: /devops:logs --since 1h
```

### Step 8: Time-Based Filtering

**For `/devops:logs --since {time}`**:

Supported formats:
- `1h` - Last 1 hour
- `30m` - Last 30 minutes
- `24h` - Last 24 hours
- `2d` - Last 2 days

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs fetch \
  --since {time}
```

### Step 9: Export Logs

Offer: "Would you like to save these logs to a file?"
- If yes:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js logs export \
    --output ".devops/logs/{timestamp}.log"
  ```

  Show: "✓ Logs saved to .devops/logs/{timestamp}.log"

---

**Netlify Logs**:

Netlify provides several types of logs:
1. **Build Logs** - Complete build output with npm install, build script execution, etc.
2. **Function Logs** - Netlify Functions execution logs (if you use serverless functions)
3. **Deploy Logs** - Deployment process logs

**Available via this plugin**:
- ✓ Build logs (complete build output)
- ✓ Deployment logs (deployment status and progress)
- ✓ Function logs (if functions are deployed)

**Note**: Real-time application logs require Netlify Functions.
For static sites, only build and deploy logs are available.

**Log Levels**:
- INFO - General information
- WARN - Warning messages
- ERROR - Error messages

**IMPORTANT**:
- Logs fetched via Netlify API (zero-token CLI)
- Build logs available for last 50 builds
- Function logs available for last 24 hours
- Real-time streaming has 30s intervals in Claude Code
- Exported logs saved to `.devops/logs/`
