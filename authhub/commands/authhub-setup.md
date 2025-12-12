---
description: Guided setup wizard for AuthHub authentication system in your Supabase project
---

You are guiding the user through setting up AuthHub - a multi-tenant authentication system for their Supabase project.

## Task: AuthHub Setup Wizard

This wizard will:
1. Check if Supabase is connected
2. Verify or set up Supabase MCP server
3. Generate product and role IDs
4. Run database migrations
5. Create constants file

---

### Step 1: Check for Existing Supabase Configuration

First, check if there's already a Supabase project configured:

1. Look for `.env.local` or `.env` file containing:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Check for `.mcp.json` file in project root with Supabase MCP configuration

**If environment variables exist**, show:
```
✓ Found Supabase configuration
  URL: [first 30 chars of URL]...

Checking MCP server connection...
```
Then proceed to Step 2.

**If no configuration found**, show:
```
⚠️ No Supabase project detected

Before we can set up AuthHub, you need a Supabase project.

Do you have an existing Supabase project? (yes/no)
```

Wait for response:
- If **yes**: Ask them to provide project details (proceed to Step 1b)
- If **no**: Guide them to create one (proceed to Step 1a)

---

### Step 1a: Guide New Supabase Project Creation

Show:
```
📋 Create a new Supabase project:

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose your organization
4. Enter project name (e.g., "yourproduct-prod")
5. Set a strong database password (save this!)
6. Select region closest to your users
7. Click "Create new project"

Wait 2-3 minutes for project to provision.

Once created, go to Settings → API and copy:
- Project URL
- anon/public key
- service_role key (keep this secret!)

Reply with "ready" when you have these values.
```

Wait for "ready", then proceed to Step 1b.

---

### Step 1b: Collect Supabase Credentials

Ask:
```
Please provide your Supabase credentials:

1. Project URL (looks like https://xxxxx.supabase.co):
```

Wait for URL, validate it looks like a Supabase URL.

Then ask:
```
2. Anon/Public Key (starts with eyJ...):
```

Wait for key.

Then ask:
```
3. Service Role Key (starts with eyJ... - keep this secret!):
```

Wait for key.

Then ask:
```
4. Project Reference ID (the xxxxx part from your URL):
```

Wait for project ref.

Create or update `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=<provided_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<provided_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<provided_service_key>
```

Show:
```
✓ Environment variables saved to .env.local

⚠️ IMPORTANT: Make sure .env.local is in your .gitignore!
```

Check `.gitignore` includes `.env.local`. If not, add it.

---

### Step 2: Check/Setup Supabase MCP Server

Check if `.mcp.json` exists and contains Supabase configuration.

**If MCP is configured**, try to list tables using `mcp__supabase__list_tables`:

- If successful: Show "✓ MCP server connected and working" → proceed to Step 3
- If fails: Show error and proceed to MCP setup below

**If MCP not configured**, show:
```
📡 Setting up Supabase MCP Server

The MCP server allows me to directly interact with your database.

You'll need a Supabase Access Token:
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name it (e.g., "Claude MCP")
4. Copy the token

Paste your access token here:
```

Wait for token.

Create or update `.mcp.json`:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/mcp-server-supabase@latest",
        "--access-token",
        "<PROVIDED_ACCESS_TOKEN>",
        "--project-ref",
        "<PROJECT_REF_FROM_STEP_1>"
      ]
    }
  }
}
```

Show:
```
✓ MCP configuration saved to .mcp.json

⚠️ IMPORTANT:
1. Add .mcp.json to .gitignore (it contains secrets)
2. Restart Claude Code for MCP to take effect

After restarting, run /authhub-setup again to continue.
```

**STOP HERE** if MCP was just configured - user needs to restart.

---

### Step 3: Verify MCP Connection

Try `mcp__supabase__list_tables` to verify connection.

**If fails**, show:
```
❌ MCP connection failed

Please verify:
1. Your access token is valid
2. The project ref is correct
3. You restarted Claude Code after adding .mcp.json

Error: [show error details]
```
Then STOP.

**If succeeds**, show:
```
✓ MCP server connected successfully
  Found {X} existing tables

Proceeding with AuthHub setup...
```

---

### Step 4: Check for Existing AuthHub Tables

Use `mcp__supabase__list_tables` to check if AuthHub tables already exist.

Look for: `user_profiles`, `tenants`, `user_tenants`, `products`, `roles`, `user_role_assignments`

**If AuthHub tables exist**, show:
```
⚠️ AuthHub tables already exist in this database!

Found: [list tables]

Options:
1. Skip migrations (use existing tables)
2. Check for missing tables and add them

Which would you like? (1 or 2)
```

Wait for response and proceed accordingly.

**If no AuthHub tables**, proceed to Step 5.

---

### Step 5: Gather Product Information

Show:
```
📦 Let's set up your product in AuthHub

What is your product name? (e.g., "TaskFlow", "InvoiceHub")
```

Wait for product name.

Then ask:
```
What is a URL-friendly slug? (lowercase, hyphens only, e.g., "task-flow")
```

Wait for slug.

Generate a UUID for the product:
```
Your Product ID: [generated UUID]

Save this - you'll need it in your code!

Proceeding with database setup...
```

---

### Step 6: Run Database Migrations

Use `mcp__supabase__apply_migration` to run each migration in order.

For each migration, show progress:
```
Running migrations...

[1/8] Core tables (user_profiles, tenants, user_tenants)... ✓
[2/8] Products and roles tables... ✓
[3/8] Permissions tables... ✓
[4/8] Invitations table... ✓
[5/8] Helper functions... ✓
[6/8] Triggers... ✓
[7/8] Your product setup ({product_name})... ✓
[8/8] RLS policies... ✓

✓ All migrations complete!
```

**If any migration fails**, show the error and offer to retry or skip.

---

### Step 7: Get Generated Role IDs

Query the database to get the role IDs that were generated:

```sql
SELECT id, name FROM public.roles WHERE product_id = '{product_id}';
```

Store these for the constants file.

---

### Step 8: Create Constants File

Create `src/lib/authhub/constants.ts`:

```typescript
// AuthHub Constants for {ProductName}
// Generated by /authhub-setup on {timestamp}

export const PRODUCT_ID = "{generated_product_id}";

export const ROLE_IDS = {
  OWNER: "{owner_role_id}",
  ADMIN: "{admin_role_id}",
  MEMBER: "{member_role_id}",
  VIEWER: "{viewer_role_id}",
} as const;

export function getRoleId(roleName: string): string {
  switch (roleName.toLowerCase()) {
    case "owner": return ROLE_IDS.OWNER;
    case "admin": return ROLE_IDS.ADMIN;
    case "member": return ROLE_IDS.MEMBER;
    case "viewer": return ROLE_IDS.VIEWER;
    default: return ROLE_IDS.MEMBER;
  }
}

export function getRoleName(roleId: string): string {
  const entries = Object.entries(ROLE_IDS);
  const found = entries.find(([_, id]) => id === roleId);
  return found ? found[0].toLowerCase() : "member";
}
```

Show:
```
✓ Created src/lib/authhub/constants.ts
```

---

### Step 9: Create Supabase Client Files

Check if Supabase client files exist. If not, create them:

1. `src/lib/supabase/client.ts` (browser client)
2. `src/lib/supabase/server.ts` (server client)
3. `src/lib/supabase/admin.ts` (admin client)

Use templates from the AuthHub skill's API_TEMPLATES.md.

Show:
```
✓ Created Supabase client files:
  - src/lib/supabase/client.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/admin.ts
```

---

### Step 10: Display Summary

Show completion summary:
```
🎉 AuthHub Setup Complete!

✓ Database: {X} tables created
✓ Product: {ProductName} ({product_id})
✓ Roles: owner, admin, member, viewer configured
✓ Constants: src/lib/authhub/constants.ts
✓ Clients: Supabase client files created

📋 Next Steps:

1. Implement API routes (see .claude/skills/authhub/API_TEMPLATES.md)
   - GET  /api/user/organizations
   - POST /api/organizations
   - POST /api/team/invite
   - etc.

2. Add OrganizationContext (see .claude/skills/authhub/FRONTEND_SETUP.md)

3. Create authentication pages:
   - /login
   - /signup
   - /create-organization

4. Test the flow:
   - Sign up a new user
   - Create an organization
   - Verify they can access it

📚 Full documentation: .claude/skills/authhub/

Would you like me to help implement any of these next steps?
```

---

## Error Handling

For any step that fails:
1. Show clear error message
2. Suggest fix
3. Offer to retry or skip (where applicable)
4. Log what was completed so user can resume

## Important Notes

- Always validate user input before using it
- Never log or display full API keys (only first/last few chars)
- Create backup before overwriting existing files
- Use proper SQL escaping when building queries
