# AuthHub Implementation Checklist

Use this checklist to track your AuthHub implementation progress.

## Phase 1: Supabase Project Setup

### Database Setup
- [ ] Create new Supabase project (or use existing)
- [ ] Enable required extensions (uuid-ossp, pgcrypto)
- [ ] Run migration 001: Core tables (user_profiles, tenants, user_tenants)
- [ ] Run migration 002: Products and roles tables
- [ ] Run migration 003: Permissions tables
- [ ] Run migration 004: Invitations table
- [ ] Run migration 005: Helper functions (has_perm, get_user_role, etc.)
- [ ] Run migration 006: Triggers (updated_at, new user handler)
- [ ] Run migration 007: Your product setup (customize product ID and roles)
- [ ] Run migration 008: RLS policies

### Authentication Settings
- [ ] Enable Email provider
- [ ] Configure email confirmation (ON for production)
- [ ] Set Site URL correctly
- [ ] Add all redirect URLs (localhost, production, preview)
- [ ] Customize email templates (optional)

### API Keys
- [ ] Note NEXT_PUBLIC_SUPABASE_URL
- [ ] Note NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Note SUPABASE_SERVICE_ROLE_KEY

---

## Phase 2: Project Setup

### Environment Variables
- [ ] Create `.env.local` file
- [ ] Add NEXT_PUBLIC_SUPABASE_URL
- [ ] Add NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Add SUPABASE_SERVICE_ROLE_KEY
- [ ] Add to `.gitignore` if not already

### Dependencies
- [ ] Install @supabase/supabase-js
- [ ] Install @supabase/ssr

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Supabase Clients
- [ ] Create `src/lib/supabase/client.ts` (browser)
- [ ] Create `src/lib/supabase/server.ts` (server components)
- [ ] Create `src/lib/supabase/admin.ts` (service role)

### Constants File
- [ ] Create `src/lib/authhub/constants.ts`
- [ ] Set PRODUCT_ID (generate UUID for your product)
- [ ] Set ROLE_IDS (query from database after setup)
- [ ] Add helper functions (getRoleId, getRoleName)

---

## Phase 3: API Routes

### User APIs
- [ ] GET `/api/user/organizations` - List user's orgs
- [ ] POST `/api/user/current-organization` - Set current org

### Organization APIs
- [ ] POST `/api/organizations` - Create organization

### Team Management APIs
- [ ] GET `/api/team/members` - List team members
- [ ] POST `/api/team/invite` - Send invitation
- [ ] POST `/api/team/accept-invitation` - Accept invitation
- [ ] POST `/api/team/change-role` - Change member role
- [ ] POST `/api/team/remove` - Remove member

### Optional APIs
- [ ] DELETE `/api/team/cancel-invitation` - Cancel pending invite
- [ ] POST `/api/team/resend-invitation` - Resend invitation
- [ ] GET `/api/invitations/[token]` - Get invitation details

---

## Phase 4: Frontend Components

### Contexts
- [ ] Create `src/contexts/OrganizationContext.tsx`
- [ ] Create `src/contexts/AuthContext.tsx` (optional)
- [ ] Add providers to root layout or dashboard layout

### Components
- [ ] Create `OrganizationSwitcher` component
- [ ] Create `ProtectedRoute` wrapper
- [ ] Create `InviteMemberModal` component
- [ ] Create team management page/components

### Middleware
- [ ] Create `src/middleware.ts` for route protection

### Pages
- [ ] Login page (`/login`)
- [ ] Signup page (`/signup`)
- [ ] Create organization page (`/create-organization`)
- [ ] Team settings page (`/settings/team`)
- [ ] Accept invitation page (`/invite/[token]`)

---

## Phase 5: Testing

### Authentication Flow
- [ ] Test signup with new user
- [ ] Test email confirmation (if enabled)
- [ ] Test login with existing user
- [ ] Test password reset
- [ ] Test logout

### Organization Flow
- [ ] Test creating new organization
- [ ] Test organization appears in switcher
- [ ] Test switching between organizations
- [ ] Test org persistence on page refresh
- [ ] Test localStorage clearing on org switch

### Team Management Flow
- [ ] Test sending invitation
- [ ] Test accepting invitation (new user)
- [ ] Test accepting invitation (existing user)
- [ ] Test changing member role
- [ ] Test removing member
- [ ] Test role-based permissions

### Edge Cases
- [ ] Test user with no organizations
- [ ] Test invitation to existing member
- [ ] Test expired invitation
- [ ] Test invalid invitation token
- [ ] Test unauthorized role changes

---

## Phase 6: Security Review

### RLS Policies
- [ ] Verify RLS enabled on all AuthHub tables
- [ ] Test that users can only see their own data
- [ ] Test that admin operations require service role

### API Security
- [ ] All routes check authentication
- [ ] All routes verify organization membership
- [ ] Role checks before sensitive operations
- [ ] No direct database access from client

### Data Isolation
- [ ] Test org A cannot see org B's data
- [ ] Test switching orgs doesn't leak data
- [ ] Test localStorage is properly scoped

---

## Phase 7: Production Readiness

### Configuration
- [ ] Update Site URL to production domain
- [ ] Add production redirect URLs
- [ ] Enable email confirmation
- [ ] Configure production email provider (if custom)

### Monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor Supabase dashboard for issues
- [ ] Set up alerts for failed auth attempts

### Documentation
- [ ] Document your product's role permissions
- [ ] Document any customizations made
- [ ] Create user guide for team management

---

## Quick Reference: Product Setup SQL

```sql
-- Replace these with your values
DO $$
DECLARE
  v_product_id UUID := 'YOUR-UUID-HERE';  -- Generate at uuidgenerator.net
BEGIN
  -- Create product
  INSERT INTO public.products (id, name, slug, description, is_active)
  VALUES (v_product_id, 'YourProduct', 'your-product', 'Description', true)
  ON CONFLICT (id) DO NOTHING;

  -- Create roles (note the generated IDs for your constants.ts)
  INSERT INTO public.roles (id, product_id, name, description) VALUES
    (gen_random_uuid(), v_product_id, 'owner', 'Organization owner'),
    (gen_random_uuid(), v_product_id, 'admin', 'Administrator'),
    (gen_random_uuid(), v_product_id, 'member', 'Team member'),
    (gen_random_uuid(), v_product_id, 'viewer', 'View only')
  ON CONFLICT (product_id, name) DO NOTHING;
END $$;

-- Then query to get the role IDs:
SELECT id, name FROM public.roles WHERE product_id = 'YOUR-UUID-HERE';
```

---

## Troubleshooting

### "Unauthorized" on all API calls
- Check that cookies are being set correctly
- Verify middleware is not blocking requests
- Check Supabase URL and keys are correct

### Organization not persisting
- Check localStorage is being set
- Verify fetchMemberships is called on mount
- Check that stored org ID exists in user's memberships

### Cross-org data showing
- Implement localStorage clearing in switchOrganization
- Add tenant validation on data load
- Verify product_id filter in queries

### Invitations not working
- Check invite token is being generated
- Verify email/phone matching logic
- Check invitation hasn't expired

### Role changes not taking effect
- Clear browser cache after role change
- Verify role_id is correct in database
- Check RLS policies aren't blocking
