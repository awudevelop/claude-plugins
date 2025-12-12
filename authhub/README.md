# AuthHub Plugin for Claude Code

A complete multi-tenant authentication system for Supabase projects.

## Features

- **Complete Database Schema** - SQL migrations for user profiles, organizations, roles, permissions, and invitations
- **API Route Templates** - Ready-to-use Next.js API routes for all auth operations
- **Frontend Components** - React context, hooks, and UI components
- **Setup Wizard** - Interactive `/authhub-setup` command to configure everything
- **RLS Policies** - Row-level security for data isolation

## Installation

### Via Marketplace (Recommended)

```bash
# In Claude Code, run:
/plugin marketplace add awudevelop/claude-plugins
/plugin install authhub@awudevelop
```

### Manual Installation

Copy the `authhub` folder to your project's `.claude/plugins/` directory.

## Usage

### Interactive Setup

Run the setup wizard to configure AuthHub in your project:

```bash
/authhub-setup
```

This will:
1. Check/configure Supabase connection
2. Set up MCP server for database access
3. Run database migrations
4. Generate your constants file with Product ID and Role IDs
5. Create Supabase client files

### Using the Skill

The AuthHub skill is automatically available when you discuss:
- Authentication setup
- Multi-tenant architecture
- Organization management
- Team invitations
- RBAC (Role-Based Access Control)

## Documentation

- **[SKILL.md](./skills/authhub/SKILL.md)** - Overview and architecture
- **[DATABASE_SCHEMA.md](./skills/authhub/DATABASE_SCHEMA.md)** - SQL migrations
- **[API_TEMPLATES.md](./skills/authhub/API_TEMPLATES.md)** - Next.js API routes
- **[FRONTEND_SETUP.md](./skills/authhub/FRONTEND_SETUP.md)** - React components
- **[SUPABASE_CONFIG.md](./skills/authhub/SUPABASE_CONFIG.md)** - Supabase settings
- **[IMPLEMENTATION_CHECKLIST.md](./skills/authhub/IMPLEMENTATION_CHECKLIST.md)** - Step-by-step guide

## Requirements

- Next.js 14+ with App Router
- Supabase project (cloud or self-hosted)
- TypeScript

## Tech Stack Compatibility

- **Framework**: Next.js 14/15
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Deployment**: Netlify, Vercel, or similar

## License

MIT
