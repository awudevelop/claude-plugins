# DevOps Plugin - Rollback Deployment

You are rolling back a deployment to a previous version.

## Task: Rollback Deployment

The user wants to rollback to a previous deployment. This is a critical operation that must be handled carefully.

### Step 1: Verify Configuration

1. Check if `.devops/config.json` exists

2. **Validate platform is supported**:
   - Read config and get platform
   - If platform is NOT "netlify", show error:
   ```
   ❌ Platform Not Supported: {platform}

   This plugin currently supports Netlify only.

   To switch to Netlify: /devops:init

   Supported platforms: Netlify
   ```
   Then STOP.

3. Check if deployments exist:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js deployments list --json
   ```

4. If no previous deployments:
   ```
   ❌ No previous deployments found
   💡 Nothing to rollback to
   ```
   Then STOP.

### Step 2: Show Deployment History

Display recent deployments:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js deployments list --limit 5
```

Show:
```
📋 Recent Deployments

Current: ✓ v1.2.3 (deployed 2h ago) - ACTIVE
         ID: dep_xyz789
         Status: Healthy
         URL: https://app.example.com

Available rollback targets:
1. v1.2.2 (deployed 1d ago)
   ID: dep_abc123
   Status: Stable
   Duration: 24h active

2. v1.2.1 (deployed 3d ago)
   ID: dep_def456
   Status: Stable
   Duration: 72h active

3. v1.2.0 (deployed 1w ago)
   ID: dep_ghi789
   Status: Stable
   Duration: 168h active

💡 Select a version to rollback to
```

### Step 3: Select Rollback Target

Parse command arguments:
- `/devops:rollback` - Rollback to previous version (auto-select v1.2.2)
- `/devops:rollback v1.2.1` - Rollback to specific version
- `/devops:rollback {deployment_id}` - Rollback to specific deployment

If no target specified, default to previous version.

### Step 4: Validate Rollback Target

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js deployments validate \
  --id {target_deployment_id}
```

Check:
- Target deployment exists
- Target is in stable state
- No breaking changes between current and target
- Platform resources still available

If validation fails:
```
❌ Cannot rollback to {target_version}

Reason: {validation_error}

💡 Try a different version or contact support
```
Then STOP.

### Step 5: Show Rollback Impact

Display impact analysis:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js rollback analyze \
  --from {current_deployment_id} \
  --to {target_deployment_id}
```

Show:
```
⚠️  Rollback Impact Analysis

Rolling back from v1.2.3 to v1.2.2

Changes that will be reverted:
  - Feature: New user dashboard
  - Fix: Database connection pool leak
  - Update: Payment gateway integration

Database migrations:
  ⚠️  2 migrations will be reverted
  - 20240115_add_user_preferences
  - 20240116_update_payment_schema

Configuration changes:
  - API_VERSION: 2.3 → 2.2
  - MAX_CONNECTIONS: 100 → 50

Potential impacts:
  ⚠️  Users will lose access to new dashboard
  ⚠️  Database schema will change
  ✓ No data loss expected

Estimated downtime: ~30 seconds
```

### Step 6: Confirm Rollback

⚠️ **CRITICAL CONFIRMATION**

Ask for confirmation:
```
⚠️  Confirm Rollback

You are about to rollback:
FROM: v1.2.3 (current)
TO:   v1.2.2

This will:
- Revert code changes
- Rollback database migrations
- Reset configuration
- Cause brief downtime (~30s)

Type 'ROLLBACK' to confirm:
```

If not exactly "ROLLBACK", STOP.

### Step 7: Create Backup

Before rollback, create backup:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js backup create \
  --deployment {current_deployment_id} \
  --reason "pre-rollback"
```

Show:
```
💾 Creating backup...
✓ Backup created: .devops/backups/{timestamp}/
```

### Step 8: Execute Rollback

Execute rollback:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js rollback execute \
  --to {target_deployment_id} \
  --track
```

Stream progress:
```
🔄 Rolling back deployment...

[00:00] Starting rollback...
[00:01] Stopping current deployment...
[00:05] Current deployment stopped
[00:06] Restoring previous version...
[00:15] Code reverted to v1.2.2
[00:16] Rolling back database migrations...
[00:25] Database rolled back
[00:26] Updating configuration...
[00:28] Starting application...
[00:35] Health check: passed
[00:36] Rollback complete
```

### Step 9: Verify Rollback

Run post-rollback verification:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js verify-deployment \
  --id {target_deployment_id}
```

Show results:
```
✓ Rollback successful!

Current deployment:
  Version: v1.2.2
  Status: Healthy
  URL: https://app.example.com

Verification:
  ✓ Application responding
  ✓ Database connected
  ✓ Health checks passing
  ✓ No errors in logs

Previous deployment (v1.2.3):
  Status: Terminated
  Backup: .devops/backups/{timestamp}/

💡 Monitor: /devops:status
💡 View logs: /devops:logs
💡 If issues persist, rollback further: /devops:rollback v1.2.1
```

### Step 10: Record Rollback

Rollback is automatically recorded:
- Added to `.devops/deployments.json`
- Logged in `.devops/rollback-history.json`
- Backup preserved in `.devops/backups/`

### Step 11: Handle Rollback Failure

If rollback fails:
```
❌ Rollback failed!

Error: {error_message}
Failed step: {failed_step}

Emergency recovery:
1. Backup is safe: .devops/backups/{timestamp}/
2. Current state: {current_state}
3. Manual intervention required

💡 Contact platform support immediately
📝 Include rollback ID: {rollback_id}
```

Then attempt emergency recovery:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js emergency-recover \
  --rollback-id {rollback_id}
```

---

**Netlify Rollback**:

Netlify rollback is **instant** and **zero-downtime**:
- Simply activates a previous deployment
- Atomic traffic swap (no downtime)
- All previous deployments remain available
- Can rollback to any previous deployment instantly

**How it works**:
1. Netlify keeps all your previous deployments
2. Rollback just makes a previous deployment the "published" one
3. No rebuild required (uses cached build)
4. Changes take effect immediately (typically < 1 second)

**Simplified for Netlify**:
- ❌ No database migrations (static sites/JAMstack)
- ❌ No complex infrastructure changes
- ❌ No downtime during rollback
- ✓ Instant rollback
- ✓ Can rollback multiple times
- ✓ Can "roll forward" to newer deployment if needed

**IMPORTANT**:
- Rollback is instant (atomic traffic swap)
- Previous deployments never deleted (available indefinitely)
- Can rollback to any deployment in history
- If using Netlify Functions, function code is also rolled back
- If using environment variables, they are NOT rolled back (managed separately)

**BEST PRACTICES**:
- Monitor application closely after rollback
- Rollback is safe and reversible (can activate newer version again)
- Document reason for rollback in deployment notes
- Check environment variables haven't changed between versions
