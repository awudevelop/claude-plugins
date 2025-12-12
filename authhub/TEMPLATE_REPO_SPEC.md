# AuthHub Next.js Template Repository Specification

This document outlines the structure for a Next.js starter template with AuthHub pre-configured.

## Repository Name Suggestion

`nextjs-authhub-template` or `create-authhub-app`

## Template Structure

```
nextjs-authhub-template/
├── .claude/
│   ├── CLAUDE.md                        # Project instructions for Claude
│   ├── plugins/
│   │   └── authhub/                     # AuthHub plugin (pre-installed)
│   │       ├── .claude-plugin/
│   │       │   └── plugin.json
│   │       ├── skills/authhub/
│   │       ├── commands/
│   │       └── README.md
│   ├── commands/                        # Custom project commands
│   │   └── (user can add)
│   ├── sessions/                        # Session management
│   └── settings.json                    # Claude Code settings
│
├── src/
│   ├── app/
│   │   ├── (auth)/                      # Auth pages (not protected)
│   │   │   ├── login/
│   │   │   │   └── page.tsx             # Login page
│   │   │   ├── signup/
│   │   │   │   └── page.tsx             # Signup page
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx               # Auth layout (no sidebar)
│   │   │
│   │   ├── (dashboard)/                 # Protected dashboard routes
│   │   │   ├── page.tsx                 # Dashboard home
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx             # Settings page
│   │   │   │   └── team/
│   │   │   │       └── page.tsx         # Team management
│   │   │   └── layout.tsx               # Dashboard layout with org switcher
│   │   │
│   │   ├── (onboarding)/                # First-time user flow
│   │   │   ├── create-organization/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       └── page.tsx             # Accept invitation page
│   │   │
│   │   ├── api/
│   │   │   ├── user/
│   │   │   │   ├── organizations/
│   │   │   │   │   └── route.ts         # GET user's orgs
│   │   │   │   └── current-organization/
│   │   │   │       └── route.ts         # POST set current org
│   │   │   ├── organizations/
│   │   │   │   └── route.ts             # POST create org
│   │   │   └── team/
│   │   │       ├── members/
│   │   │       │   └── route.ts         # GET team members
│   │   │       ├── invite/
│   │   │       │   └── route.ts         # POST invite member
│   │   │       ├── accept-invitation/
│   │   │       │   └── route.ts         # POST accept invite
│   │   │       ├── change-role/
│   │   │       │   └── route.ts         # POST change role
│   │   │       └── remove/
│   │   │           └── route.ts         # POST remove member
│   │   │
│   │   ├── layout.tsx                   # Root layout
│   │   └── page.tsx                     # Landing page (redirects)
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── ForgotPasswordForm.tsx
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── organization/
│   │   │   ├── OrganizationSwitcher.tsx
│   │   │   └── CreateOrganizationForm.tsx
│   │   ├── team/
│   │   │   ├── TeamMembersList.tsx
│   │   │   ├── InviteMemberModal.tsx
│   │   │   └── RoleSelector.tsx
│   │   └── ui/                          # Basic UI components (no shadcn)
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Modal.tsx
│   │       └── Card.tsx
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx              # Auth state management
│   │   └── OrganizationContext.tsx      # Org state management
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useOrganization.ts
│   │   └── useTeam.ts
│   │
│   ├── lib/
│   │   ├── authhub/
│   │   │   └── constants.ts             # PLACEHOLDER - filled by setup
│   │   ├── supabase/
│   │   │   ├── client.ts                # Browser client
│   │   │   ├── server.ts                # Server client
│   │   │   └── admin.ts                 # Admin client
│   │   ├── permissions.ts               # Permission checking
│   │   └── utils.ts
│   │
│   └── middleware.ts                    # Auth middleware
│
├── supabase/
│   └── migrations/                      # AuthHub migrations (optional)
│       ├── 001_authhub_core.sql
│       ├── 002_authhub_products_roles.sql
│       ├── 003_authhub_permissions.sql
│       ├── 004_authhub_invitations.sql
│       ├── 005_authhub_functions.sql
│       ├── 006_authhub_triggers.sql
│       └── 007_authhub_rls.sql
│
├── .env.example                         # Environment variable template
├── .env.local                           # (gitignored) Actual env vars
├── .gitignore
├── .mcp.json.example                    # MCP config template
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## Key Files Content

### `.env.example`

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Email provider for invitations
# RESEND_API_KEY=your_resend_key
```

### `.mcp.json.example`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/mcp-server-supabase@latest",
        "--access-token",
        "YOUR_ACCESS_TOKEN",
        "--project-ref",
        "YOUR_PROJECT_REF"
      ]
    }
  }
}
```

### `src/lib/authhub/constants.ts` (Placeholder)

```typescript
// AuthHub Constants
// Run /authhub-setup to generate these values for your product

export const PRODUCT_ID = "PLACEHOLDER_RUN_AUTHHUB_SETUP";

export const ROLE_IDS = {
  OWNER: "PLACEHOLDER",
  ADMIN: "PLACEHOLDER",
  MEMBER: "PLACEHOLDER",
  VIEWER: "PLACEHOLDER",
} as const;

// ... rest of helpers
```

### `.claude/CLAUDE.md`

```markdown
# Project Name

## Overview

This project uses AuthHub for multi-tenant authentication.

## Quick Start

1. Run `/authhub-setup` to configure your Supabase project
2. This will set up the database and generate your constants

## AuthHub Documentation

See `.claude/plugins/authhub/` for complete documentation.

## Development Commands

\`\`\`bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run linting
\`\`\`
```

## Usage Instructions (README.md)

```markdown
# Next.js AuthHub Template

A Next.js starter with multi-tenant authentication pre-configured.

## Quick Start

### 1. Create Your Project

\`\`\`bash
npx create-next-app@latest my-app --example https://github.com/awudevelop/nextjs-authhub-template
cd my-app
\`\`\`

### 2. Set Up Supabase

1. Create a project at https://supabase.com
2. Copy `.env.example` to `.env.local`
3. Fill in your Supabase credentials

### 3. Run AuthHub Setup

In Claude Code:

\`\`\`bash
/authhub-setup
\`\`\`

This will:
- Configure MCP server connection
- Run database migrations
- Generate your Product ID and Role IDs

### 4. Start Development

\`\`\`bash
npm run dev
\`\`\`

## What's Included

- ✅ User authentication (signup, login, logout)
- ✅ Organization creation and switching
- ✅ Team management (invite, roles, remove)
- ✅ Role-based access control
- ✅ Protected routes with middleware
- ✅ Claude Code integration with AuthHub skill
```

## Customization Points

When teammates clone the template, they should:

1. **Run `/authhub-setup`** - Generates their unique Product ID and Role IDs
2. **Customize `constants.ts`** - Add product-specific permissions
3. **Add product tables** - With `organization_id` column and RLS
4. **Customize UI** - Modify components to match their brand
5. **Add features** - Build on top of the auth foundation

## Future Enhancements

- [ ] Add more starter pages (profile, billing placeholder)
- [ ] Include example product table with RLS
- [ ] Add email templates for invitations
- [ ] Include Netlify/Vercel deployment configs
- [ ] Add testing setup (Jest, Playwright)
