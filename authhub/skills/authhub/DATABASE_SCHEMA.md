# AuthHub Database Schema

Complete SQL migrations to set up AuthHub in a new Supabase project.

## Data Isolation Strategy

**RECOMMENDED: RLS with organization_id** (used by most SaaS apps)

Your product tables should include an `organization_id` column with RLS policies:

```sql
-- Example product table
CREATE TABLE public.your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.tenants(id),
  -- your columns here
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- Users can only see their organization's data
CREATE POLICY "Org isolation" ON public.your_table
FOR ALL USING (
  organization_id IN (
    SELECT tenant_id FROM public.user_tenants
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**ADVANCED: Schema-per-tenant** (for apps like DataSwim where users create their own tables)
- Only use if tenants need different table structures
- See `create_tenant_schema` function in Helper Functions section

---

## Migration Order

Run these migrations in order:

1. [Core Tables](#1-core-tables)
2. [Products and Roles](#2-products-and-roles)
3. [Permissions](#3-permissions)
4. [Invitations](#4-invitations)
5. [Helper Functions](#5-helper-functions)
6. [Triggers](#6-triggers)

---

## 1. Core Tables

```sql
-- Migration: 001_authhub_core_tables

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on email for lookups
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_idx ON public.user_profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_phone_idx ON public.user_profiles(phone) WHERE phone IS NOT NULL;

-- Tenants (organizations)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES auth.users(id),
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenants_owner_idx ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants(slug);

-- User-Tenant membership (which orgs a user belongs to)
CREATE TABLE IF NOT EXISTS public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS user_tenants_user_idx ON public.user_tenants(user_id);
CREATE INDEX IF NOT EXISTS user_tenants_tenant_idx ON public.user_tenants(tenant_id);
```

---

## 2. Products and Roles

```sql
-- Migration: 002_authhub_products_roles

-- Products (your different applications)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles (per product)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, name)
);

CREATE INDEX IF NOT EXISTS roles_product_idx ON public.roles(product_id);

-- User Role Assignments (user + tenant + product + role)
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS ura_user_idx ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS ura_tenant_idx ON public.user_role_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS ura_product_idx ON public.user_role_assignments(product_id);
CREATE INDEX IF NOT EXISTS ura_composite_idx ON public.user_role_assignments(user_id, tenant_id, product_id);

-- Tenant-Product subscriptions (which products a tenant has access to)
CREATE TABLE IF NOT EXISTS public.tenant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  plan_type TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  seats_limit INTEGER DEFAULT 5,
  seats_used INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS tp_tenant_idx ON public.tenant_products(tenant_id);
CREATE INDEX IF NOT EXISTS tp_product_idx ON public.tenant_products(product_id);
```

---

## 3. Permissions

```sql
-- Migration: 003_authhub_permissions

-- Permissions (per product)
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, name)
);

CREATE INDEX IF NOT EXISTS permissions_product_idx ON public.permissions(product_id);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS rp_role_idx ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS rp_permission_idx ON public.role_permissions(permission_id);
```

---

## 4. Invitations

```sql
-- Migration: 004_authhub_invitations

-- Team invitations
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  role_id UUID NOT NULL REFERENCES public.roles(id),
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invites_tenant_idx ON public.invites(tenant_id);
CREATE INDEX IF NOT EXISTS invites_token_idx ON public.invites(token);
CREATE INDEX IF NOT EXISTS invites_email_idx ON public.invites(email);
CREATE INDEX IF NOT EXISTS invites_phone_idx ON public.invites(phone);
CREATE INDEX IF NOT EXISTS invites_status_idx ON public.invites(status);
```

---

## 5. Helper Functions

```sql
-- Migration: 005_authhub_functions

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_perm(
  p_user_id UUID,
  p_tenant_id UUID,
  p_product_id UUID,
  p_perm_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ura.user_id = p_user_id
      AND ura.tenant_id = p_tenant_id
      AND ura.product_id = p_product_id
      AND ura.is_active = true
      AND rp.is_active = true
      AND p.name = p_perm_name
      AND p.is_active = true
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role for a tenant/product
CREATE OR REPLACE FUNCTION public.get_user_role(
  p_user_id UUID,
  p_tenant_id UUID,
  p_product_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  SELECT r.name INTO v_role_name
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE ura.user_id = p_user_id
    AND ura.tenant_id = p_tenant_id
    AND ura.product_id = p_product_id
    AND ura.is_active = true;

  RETURN v_role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- OPTIONAL: Function to create tenant schema for data isolation
-- Only needed if using schema-per-tenant strategy (advanced use case)
-- Most apps should use RLS with organization_id instead
CREATE OR REPLACE FUNCTION public.create_tenant_schema(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  -- Generate schema name: tenant_<uuid_without_hyphens>
  v_schema_name := 'tenant_' || REPLACE(p_tenant_id::TEXT, '-', '');

  -- Create the schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);

  -- Grant usage to authenticated users (they'll be restricted by RLS)
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', v_schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', v_schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO authenticated', v_schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate URL-safe slug
CREATE OR REPLACE FUNCTION public.generate_slug(p_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(p_name),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Triggers

```sql
-- Migration: 006_authhub_triggers

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_tenants_updated_at
  BEFORE UPDATE ON public.user_tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_role_assignments_updated_at
  BEFORE UPDATE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_invites_updated_at
  BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create user_profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, phone)
  VALUES (NEW.id, NEW.email, NEW.phone)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger on auth.users requires special setup
-- Run this in the Supabase SQL Editor with service role:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 7. Initial Product Setup

```sql
-- Migration: 007_setup_your_product
-- CUSTOMIZE THIS for your product!

-- Replace these values with your product details
DO $$
DECLARE
  v_product_id UUID := 'YOUR-PRODUCT-UUID-HERE'; -- Generate a UUID for your product
  v_product_name TEXT := 'YourProductName';
  v_product_slug TEXT := 'your-product';
BEGIN
  -- Insert your product
  INSERT INTO public.products (id, name, slug, description, is_active)
  VALUES (
    v_product_id,
    v_product_name,
    v_product_slug,
    'Your product description',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert roles for your product (customize as needed)
  INSERT INTO public.roles (id, product_id, name, description, is_active) VALUES
    (gen_random_uuid(), v_product_id, 'owner', 'Organization owner with full access', true),
    (gen_random_uuid(), v_product_id, 'admin', 'Administrator with management access', true),
    (gen_random_uuid(), v_product_id, 'member', 'Standard team member', true),
    (gen_random_uuid(), v_product_id, 'viewer', 'Read-only access', true)
  ON CONFLICT (product_id, name) DO NOTHING;

  -- Insert permissions for your product (customize as needed)
  INSERT INTO public.permissions (product_id, name, description, is_active) VALUES
    (v_product_id, 'team.invite', 'Can invite team members', true),
    (v_product_id, 'team.remove', 'Can remove team members', true),
    (v_product_id, 'team.manage_roles', 'Can change member roles', true),
    (v_product_id, 'settings.view', 'Can view settings', true),
    (v_product_id, 'settings.edit', 'Can edit settings', true),
    (v_product_id, 'billing.view', 'Can view billing', true),
    (v_product_id, 'billing.manage', 'Can manage billing', true)
  ON CONFLICT (product_id, name) DO NOTHING;
END $$;
```

---

## Row Level Security (RLS) Policies

```sql
-- Migration: 008_authhub_rls

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tenants: Users can view tenants they belong to
CREATE POLICY "Users can view their tenants" ON public.tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.tenant_id = tenants.id
        AND ut.user_id = auth.uid()
        AND ut.is_active = true
    )
  );

-- User tenants: Users can view their own memberships
CREATE POLICY "Users can view own tenant memberships" ON public.user_tenants
  FOR SELECT USING (user_id = auth.uid());

-- Products and Roles: Read-only for authenticated users
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Authenticated users can view roles" ON public.roles
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Authenticated users can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (is_active = true);

-- Note: Write operations should go through API routes with service role
```

---

## Quick Setup Script

Run this to create all tables at once:

```sql
-- Run migrations 001-008 in order
-- Or use Supabase migrations: supabase migration new authhub_setup
-- Then paste all SQL above into the migration file
```
