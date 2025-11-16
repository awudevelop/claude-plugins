# DevOps Plugin - Secrets Management

You are managing secrets and credentials for deployments.

## Task: Manage Secrets

The user wants to set, get, or manage secrets. **CRITICAL**: Handle secrets securely and never log them.

---

## Quick Start: Netlify Token Setup

**If user just ran `/devops:init` and needs to set up Netlify token:**

1. Show this message first:
```
🔐 Netlify API Token Setup

You need a Netlify API token to deploy. This will be stored encrypted locally.

📍 Get your token: https://app.netlify.com/user/applications
   → Click "New access token"
   → Name it: "Claude DevOps Plugin"
   → Copy the token (starts with "nfp_...")

⚡ Quick setup:
```

2. Use the AskUserQuestion tool to ask:
   **Question**: "Do you have your Netlify API token ready?"
   **Options**:
   - "Yes, I have my token" → Continue to Step 3
   - "No, I'll get it now" → Show URL again and wait

3. Ask for the token value:
   "Paste your Netlify API token: (starts with nfp_...)"

   ⚠️ Security note: Input will be visible in chat.
   For maximum security, use CLI: `node cli/devops-cli.js secrets set --name NETLIFY_API_TOKEN --value <token>`

4. Set the secret via CLI:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets set \
     --name "NETLIFY_API_TOKEN" \
     --value "{token}"
   ```

5. **IMPORTANT: Validate token immediately** using netlify-validator:
   ```bash
   node -e "
   const validator = require('${CLAUDE_PLUGIN_ROOT}/cli/lib/validators/netlify-validator');
   validator.validateToken('{token}').then(result => {
     console.log(JSON.stringify(result, null, 2));
   });
   "
   ```

6. Show result based on validation:
   - If valid:
     ```
     ✓ Token validated successfully!
     ✓ Connected to Netlify as: {email}
     ✓ Token encrypted and stored locally

     Next steps:
     1. Deploy your app: /devops:deploy
     2. Check status: /devops:status
     ```

   - If invalid:
     ```
     ❌ Token validation failed

     Common issues:
     - Token might be expired
     - Token might be incorrect
     - Check your internet connection

     💡 Get a new token: https://app.netlify.com/user/applications
     💡 Try again: /devops:secrets set
     ```

---

### Step 1: Check Configuration

1. Check if `.devops/config.json` exists
2. Read secrets mode:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config get --key secrets_mode
   ```

### Step 2: Parse Secrets Command

Parse subcommand:
- `/devops:secrets set` - Set/update a secret
- `/devops:secrets get {name}` - Get a secret (masked)
- `/devops:secrets list` - List all secret names (not values!)
- `/devops:secrets delete {name}` - Delete a secret
- `/devops:secrets validate` - Validate all secrets
- `/devops:secrets rotate {name}` - Rotate a secret
- `/devops:secrets sync` - Sync with external provider

### Step 3: Set Secret

**For `/devops:secrets set`**:

⚠️ **SECURITY CRITICAL**

1. Ask for secret name:
   "What is the secret name? (e.g., DATABASE_PASSWORD, API_KEY)"

2. Ask for secret value:
   "Enter the secret value: (will not be displayed)"

   **IMPORTANT**: In Claude Code, we can't hide input, so warn user:
   ```
   ⚠️  Security Note: Your input will be visible in the chat
   For maximum security, use environment variables or direct CLI input

   Alternative: Set via CLI directly:
   $ node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets set \
       --name {name} --value {value}
   ```

3. Ask to proceed or use CLI:
   - If "Use CLI", provide command and STOP
   - If "Proceed", continue (but warn again)

4. Set secret via CLI:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets set \
     --name "{name}" \
     --value "{value}" \
     --mode "{secrets_mode}"
   ```

   **Secrets Mode Handling**:
   - **local**: Encrypt and store in `.devops/credentials.enc`
   - **aws**: Store in AWS Secrets Manager
   - **gcp**: Store in GCP Secret Manager
   - **azure**: Store in Azure Key Vault
   - **manual**: Just validate format, don't store

5. Show confirmation:
   ```
   ✓ Secret set successfully

   Name: {name}
   Mode: {secrets_mode}
   Storage: {storage_location}
   Encrypted: ✓

   💡 Validate: /devops:secrets validate
   💡 Use in deployment: Environment variable {name}
   ```

### Step 4: Get Secret (Masked)

**For `/devops:secrets get {name}`**:

⚠️ **NEVER display full secret values in chat**

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets get \
  --name "{name}" \
  --masked
```

Display:
```
🔐 Secret: {name}

Value: {first_4_chars}••••••••••••{last_4_chars}
Length: {length} characters
Type: {type} (e.g., API key, password, token)
Storage: {storage_location}
Created: {created_timestamp}
Last rotated: {last_rotated}

⚠️  Full value not shown for security
💡 To use: Reference as environment variable ${name}
💡 Rotate: /devops:secrets rotate {name}
```

Example:
```
🔐 Secret: DATABASE_PASSWORD

Value: post••••••••••••rd123
Length: 24 characters
Type: password
Storage: AWS Secrets Manager
Created: 2024-01-15 10:30
Last rotated: Never

⚠️  Full value not shown for security
```

### Step 5: List Secrets

**For `/devops:secrets list`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets list
```

Display:
```
🔐 Secrets Inventory

Total secrets: {count}
Storage mode: {secrets_mode}

Secrets:
1. DATABASE_PASSWORD
   Type: password
   Created: 2024-01-15
   Status: ✓ Valid

2. API_KEY_STRIPE
   Type: api-key
   Created: 2024-01-16
   Status: ✓ Valid

3. JWT_SECRET
   Type: token
   Created: 2024-01-10
   Status: ⚠️  Expiring soon

4. AWS_ACCESS_KEY
   Type: access-key
   Created: 2024-01-12
   Status: ✓ Valid

⚠️  1 secret needs attention
💡 Rotate expiring secrets: /devops:secrets rotate JWT_SECRET
💡 Add new secret: /devops:secrets set
```

### Step 6: Delete Secret

**For `/devops:secrets delete {name}`**:

⚠️ **DESTRUCTIVE OPERATION**

1. Confirm deletion:
   ```
   ⚠️  Delete Secret: {name}

   This will permanently delete:
   - Secret value
   - Secret metadata
   - All references

   Applications using this secret will fail!

   Type 'DELETE' to confirm:
   ```

2. If not "DELETE", STOP

3. Delete secret:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets delete \
     --name "{name}" \
     --confirm
   ```

4. Show result:
   ```
   ✓ Secret deleted: {name}

   💾 Backup saved: .devops/secrets-backup/{timestamp}/{name}.enc

   ⚠️  Remember to:
   - Update application code
   - Remove environment variable references
   - Deploy updated configuration
   ```

### Step 7: Validate Secrets

**For `/devops:secrets validate`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets validate --all
```

Display validation results:
```
🔍 Validating secrets...

DATABASE_PASSWORD:
  ✓ Encrypted properly
  ✓ Accessible
  ✓ Format valid
  ✓ Length sufficient (24 chars)

API_KEY_STRIPE:
  ✓ Encrypted properly
  ✓ Accessible
  ⚠️  Format warning: Should start with 'sk_'
  ✓ Length sufficient

JWT_SECRET:
  ✓ Encrypted properly
  ✓ Accessible
  ✓ Format valid
  ⚠️  Expiring in 7 days (recommend rotation)

AWS_ACCESS_KEY:
  ✓ Encrypted properly
  ✓ Accessible
  ✓ Format valid (matches AWS pattern)
  ✓ Still valid with AWS

Overall: 4/4 accessible, 2 warnings

💡 Fix warnings for best security
```

### Step 8: Rotate Secret

**For `/devops:secrets rotate {name}`**:

1. Show rotation options:
   ```
   🔄 Rotate Secret: {name}

   Choose rotation method:
   1. Auto-generate new value
   2. Manually provide new value
   3. Use external provider rotation
   ```

2. Based on choice:

   **Auto-generate**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets rotate \
     --name "{name}" \
     --auto-generate \
     --length 32
   ```

   **Manual**:
   Ask for new value and set like `/devops:secrets set`

   **Provider rotation** (AWS/GCP/Azure):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets rotate \
     --name "{name}" \
     --provider-managed
   ```

3. Show result:
   ```
   ✓ Secret rotated: {name}

   Old value: Archived
   New value: Set and encrypted
   Backup: .devops/secrets-backup/{timestamp}/{name}.enc

   ⚠️  Next steps:
   1. Update applications to use new value
   2. Deploy updated configuration
   3. Monitor for auth errors
   4. Remove old value after verification

   💡 Old value available for 24h in backup
   ```

### Step 9: Sync with External Provider

**For `/devops:secrets sync`**:

Sync local secrets with external provider:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js secrets sync \
  --provider "{secrets_mode}"
```

Display:
```
🔄 Syncing secrets with {provider}...

Local secrets: {local_count}
Remote secrets: {remote_count}

Sync operations:
↓ Pull from remote: {pull_count} secrets
  - NEW_SECRET_1
  - UPDATED_SECRET_2

↑ Push to remote: {push_count} secrets
  - LOCAL_SECRET_1

→ No change: {unchanged_count} secrets

Proceed with sync?
```

If yes:
```
✓ Sync completed

↓ Pulled: {pull_count}
↑ Pushed: {push_count}
→ Unchanged: {unchanged_count}

All secrets synchronized
```

---

**Secrets Storage Modes**:

**Local Mode** (`.devops/credentials.enc`):
- AES-256 encryption
- Master key in environment variable
- Suitable for development
- ⚠️ Not recommended for production

**AWS Secrets Manager**:
- AWS-managed encryption (KMS)
- Auto-rotation support
- Fine-grained access control
- Versioning included

**GCP Secret Manager**:
- Google-managed encryption
- IAM-based access control
- Automatic replication
- Version history

**Azure Key Vault**:
- Azure-managed encryption
- RBAC access control
- Soft-delete protection
- Version tracking

**Manual Mode**:
- No storage in plugin
- User provides at deployment time
- Most secure (no persistence)
- Requires manual input each time

**SECURITY BEST PRACTICES**:

1. **Never log secrets**: All CLI operations use `--no-log` flag
2. **Rotate regularly**: Recommend 90-day rotation
3. **Use strong secrets**: Min 16 chars, mixed characters
4. **Limit access**: Only necessary secrets per environment
5. **Monitor usage**: Track secret access in provider logs
6. **Backup safely**: Encrypted backups in `.devops/secrets-backup/`
7. **Delete old versions**: After rotation and verification

**IMPORTANT**:
- Secrets are NEVER committed to git
- `.devops/credentials.enc` is in `.gitignore`
- All CLI secret operations are zero-token
- Secrets are encrypted at rest
- Full audit trail in `.devops/secrets-audit.log`
