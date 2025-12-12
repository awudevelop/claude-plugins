# AuthHub API Templates

Copy these Next.js API route templates and customize for your product.

## Setup: Supabase Clients

First, create your Supabase client files:

### `src/lib/supabase/client.ts` (Browser)

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `src/lib/supabase/server.ts` (Server Components/API Routes)

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  );
}
```

### `src/lib/supabase/admin.ts` (Service Role - Server Only)

```typescript
import { createClient } from '@supabase/supabase-js';

export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

---

## Setup: Constants File

### `src/lib/authhub/constants.ts`

```typescript
// CUSTOMIZE THESE FOR YOUR PRODUCT
// Generate UUIDs: https://www.uuidgenerator.net/

export const PRODUCT_ID = "YOUR-PRODUCT-UUID-HERE";

export const ROLE_IDS = {
  OWNER: "your-owner-role-uuid",
  ADMIN: "your-admin-role-uuid",
  MEMBER: "your-member-role-uuid",
  VIEWER: "your-viewer-role-uuid",
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

---

## API Routes

### 1. Get User's Organizations

**`src/app/api/user/organizations/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID } from "@/lib/authhub/constants";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminSupabase();

    // Get user's organizations for THIS product only
    const { data: memberships, error } = await admin
      .from("user_role_assignments")
      .select(`
        id,
        created_at,
        role:roles (id, name),
        tenant:tenants (id, name, slug)
      `)
      .eq("user_id", user.id)
      .eq("product_id", PRODUCT_ID)  // <-- CRITICAL: Filter by your product
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching memberships:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    // Transform to expected format
    const transformed = (memberships || [])
      .map((m: any) => ({
        id: m.id,
        role: m.role?.name || "member",
        organization: m.tenant ? {
          id: m.tenant.id,
          name: m.tenant.name,
          slug: m.tenant.slug,
        } : null,
      }))
      .filter((m: any) => m.organization !== null)
      .sort((a: any, b: any) => {
        // Sort alphabetically by org name
        const nameA = a.organization.name?.toLowerCase() || "";
        const nameB = b.organization.name?.toLowerCase() || "";
        return nameA.localeCompare(nameB);
      });

    return NextResponse.json({ memberships: transformed });
  } catch (error) {
    console.error("Error in organizations route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 2. Create Organization

**`src/app/api/organizations/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID, ROLE_IDS } from "@/lib/authhub/constants";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, planType = "free" } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // 1. Create tenant
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: name.trim(),
        slug: generateSlug(name),
        owner_id: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Error creating tenant:", tenantError);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    // 2. Create tenant_products entry
    await admin
      .from("tenant_products")
      .insert({
        tenant_id: tenant.id,
        product_id: PRODUCT_ID,
        plan_type: planType,
        status: "active",
        seats_limit: 5,
        seats_used: 1,
        is_active: true,
      });

    // 3. Create user_tenants entry
    await admin
      .from("user_tenants")
      .insert({
        user_id: user.id,
        tenant_id: tenant.id,
        is_active: true,
      });

    // 4. Create user_role_assignments with OWNER role
    await admin
      .from("user_role_assignments")
      .insert({
        user_id: user.id,
        tenant_id: tenant.id,
        product_id: PRODUCT_ID,
        role_id: ROLE_IDS.OWNER,
        is_active: true,
        created_by: user.id,
      });

    // 5. Ensure user_profile exists
    await admin
      .from("user_profiles")
      .upsert({
        id: user.id,
        email: user.email,
        phone: user.phone,
        is_active: true,
      }, { onConflict: "id" });

    // 6. Create tenant schema for data isolation (optional)
    await admin.rpc("create_tenant_schema", { p_tenant_id: tenant.id });

    return NextResponse.json({
      organization: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 3. Invite Team Member

**`src/app/api/team/invite/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID, getRoleId } from "@/lib/authhub/constants";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { organizationId, email, phone, role = "member" } = body;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    if (!email && !phone) {
      return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Verify user has permission to invite
    const { data: userRole } = await admin
      .from("user_role_assignments")
      .select("role:roles (name)")
      .eq("user_id", user.id)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    const userRoleName = (userRole?.role as any)?.name;
    if (!["owner", "admin"].includes(userRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await admin
      .from("invites")
      .select("id")
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("status", "pending")
      .eq("is_active", true)
      .or(`email.eq.${email?.toLowerCase()},phone.eq.${phone}`)
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: "Invitation already pending" }, { status: 400 });
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await admin
      .from("invites")
      .insert({
        tenant_id: organizationId,
        product_id: PRODUCT_ID,
        email: email?.toLowerCase(),
        phone: phone,
        role_id: getRoleId(role),
        status: "pending",
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }

    // TODO: Send invitation email/SMS
    // You can call an edge function or use a service like Resend/SendGrid here

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        token: invitation.token,
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("Error inviting member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 4. Accept Invitation

**`src/app/api/team/accept-invitation/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Invitation token required" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Get invitation
    const { data: invitation, error: inviteError } = await admin
      .from("invites")
      .select(`
        id, email, phone, role_id, tenant_id, product_id,
        status, expires_at, accepted_at,
        tenant:tenants (id, name)
      `)
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return NextResponse.json({ error: "Invitation already accepted" }, { status: 400 });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await admin
        .from("invites")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
    }

    // Get user profile to match email/phone
    const { data: userProfile } = await admin
      .from("user_profiles")
      .select("email, phone")
      .eq("id", user.id)
      .single();

    // Verify invitation matches user
    const emailMatch = invitation.email && userProfile?.email?.toLowerCase() === invitation.email.toLowerCase();
    const phoneMatch = invitation.phone && userProfile?.phone === invitation.phone;

    if (!emailMatch && !phoneMatch) {
      return NextResponse.json({
        error: "This invitation was sent to a different email/phone",
      }, { status: 403 });
    }

    // Check if user already in this org
    const { data: existingMembership } = await admin
      .from("user_role_assignments")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", invitation.tenant_id)
      .eq("product_id", invitation.product_id)
      .eq("is_active", true)
      .single();

    if (existingMembership) {
      return NextResponse.json({ error: "Already a member of this organization" }, { status: 400 });
    }

    // Create user_tenants entry
    await admin
      .from("user_tenants")
      .upsert({
        user_id: user.id,
        tenant_id: invitation.tenant_id,
        is_active: true,
      }, { onConflict: "user_id,tenant_id" });

    // Create user_role_assignments
    await admin
      .from("user_role_assignments")
      .insert({
        user_id: user.id,
        tenant_id: invitation.tenant_id,
        product_id: invitation.product_id,
        role_id: invitation.role_id,
        is_active: true,
      });

    // Mark invitation as accepted
    await admin
      .from("invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        status: "accepted",
      })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      organization: {
        id: (invitation.tenant as any)?.id,
        name: (invitation.tenant as any)?.name,
      },
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 5. Get Team Members

**`src/app/api/team/members/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID } from "@/lib/authhub/constants";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = req.nextUrl.searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Verify user belongs to this org
    const { data: membership } = await admin
      .from("user_role_assignments")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    // Get all members
    const { data: members, error: membersError } = await admin
      .from("user_role_assignments")
      .select(`
        id,
        user_id,
        created_at,
        role:roles (id, name),
        user:user_profiles (id, email, name, phone, avatar_url)
      `)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error("Error fetching members:", membersError);
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }

    // Get pending invitations
    const { data: invitations } = await admin
      .from("invites")
      .select(`
        id, email, phone, token, created_at, expires_at, status,
        role:roles (id, name)
      `)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("status", "pending")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      members: members || [],
      invitations: invitations || [],
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 6. Update Current Organization

**`src/app/api/user/current-organization/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID } from "@/lib/authhub/constants";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Verify user belongs to this org
    const { data: membership, error: membershipError } = await admin
      .from("user_role_assignments")
      .select("id, role:roles (name)")
      .eq("user_id", user.id)
      .eq("tenant_id", organization_id)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    // Optionally store current org in user metadata
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        current_organization_id: organization_id,
      },
    });

    return NextResponse.json({
      success: true,
      organization_id,
      role: (membership.role as any)?.name,
    });
  } catch (error) {
    console.error("Error updating current organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 7. Change Member Role

**`src/app/api/team/change-role/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID, ROLE_IDS, getRoleId } from "@/lib/authhub/constants";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { organizationId, targetUserId, newRole } = body;

    if (!organizationId || !targetUserId || !newRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Check requester's role
    const { data: requesterRole } = await admin
      .from("user_role_assignments")
      .select("role_id, role:roles (name)")
      .eq("user_id", user.id)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    const requesterRoleName = (requesterRole?.role as any)?.name;

    // Only owner/admin can change roles
    if (!["owner", "admin"].includes(requesterRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get target's current role
    const { data: targetRole } = await admin
      .from("user_role_assignments")
      .select("role_id, role:roles (name)")
      .eq("user_id", targetUserId)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    if (!targetRole) {
      return NextResponse.json({ error: "User not found in organization" }, { status: 404 });
    }

    const targetRoleName = (targetRole?.role as any)?.name;

    // Prevent demoting owner (unless by another owner)
    if (targetRoleName === "owner" && requesterRoleName !== "owner") {
      return NextResponse.json({ error: "Cannot change owner's role" }, { status: 403 });
    }

    // Prevent promoting to owner (unless by owner)
    if (newRole === "owner" && requesterRoleName !== "owner") {
      return NextResponse.json({ error: "Only owner can promote to owner" }, { status: 403 });
    }

    // Update role
    const { error: updateError } = await admin
      .from("user_role_assignments")
      .update({
        role_id: getRoleId(newRole),
        updated_by: user.id,
      })
      .eq("user_id", targetUserId)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true);

    if (updateError) {
      console.error("Error updating role:", updateError);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }

    return NextResponse.json({ success: true, newRole });
  } catch (error) {
    console.error("Error changing role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### 8. Remove Team Member

**`src/app/api/team/remove/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID } from "@/lib/authhub/constants";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { organizationId, targetUserId } = body;

    if (!organizationId || !targetUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Check requester's role
    const { data: requesterRole } = await admin
      .from("user_role_assignments")
      .select("role:roles (name)")
      .eq("user_id", user.id)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    const requesterRoleName = (requesterRole?.role as any)?.name;

    if (!["owner", "admin"].includes(requesterRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get target's role
    const { data: targetRole } = await admin
      .from("user_role_assignments")
      .select("role:roles (name)")
      .eq("user_id", targetUserId)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .single();

    const targetRoleName = (targetRole?.role as any)?.name;

    // Prevent removing owner
    if (targetRoleName === "owner") {
      return NextResponse.json({ error: "Cannot remove organization owner" }, { status: 403 });
    }

    // Soft-delete from user_role_assignments
    await admin
      .from("user_role_assignments")
      .update({ is_active: false, updated_by: user.id })
      .eq("user_id", targetUserId)
      .eq("tenant_id", organizationId)
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true);

    // Soft-delete from user_tenants
    await admin
      .from("user_tenants")
      .update({ is_active: false })
      .eq("user_id", targetUserId)
      .eq("tenant_id", organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## Permission Checking Utility

### `src/lib/permissions.ts`

```typescript
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRODUCT_ID, ROLE_IDS } from "@/lib/authhub/constants";

export async function checkPermission(
  userId: string,
  organizationId: string,
  permissionKey: string
): Promise<boolean> {
  const admin = createAdminSupabase();

  // Get user's role
  const { data: roleAssignment } = await admin
    .from("user_role_assignments")
    .select("role_id, role:roles (name)")
    .eq("user_id", userId)
    .eq("tenant_id", organizationId)
    .eq("product_id", PRODUCT_ID)
    .eq("is_active", true)
    .single();

  if (!roleAssignment) return false;

  // Owner has all permissions
  if (roleAssignment.role_id === ROLE_IDS.OWNER) return true;

  // Check specific permission via database function
  const { data: hasPermission } = await admin.rpc("has_perm", {
    p_user_id: userId,
    p_tenant_id: organizationId,
    p_product_id: PRODUCT_ID,
    p_perm_name: permissionKey,
  });

  return !!hasPermission;
}

export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const admin = createAdminSupabase();

  const { data } = await admin
    .from("user_role_assignments")
    .select("role:roles (name)")
    .eq("user_id", userId)
    .eq("tenant_id", organizationId)
    .eq("product_id", PRODUCT_ID)
    .eq("is_active", true)
    .single();

  return (data?.role as any)?.name || null;
}
```
