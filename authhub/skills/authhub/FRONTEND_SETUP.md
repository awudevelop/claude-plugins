# AuthHub Frontend Setup

React context, hooks, and components for AuthHub integration.

## 1. Organization Context

The core context that manages organization state, switching, and user memberships.

### `src/contexts/OrganizationContext.tsx`

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Types
interface Organization {
  id: string;
  name: string;
  slug: string | null;
}

interface OrganizationMembership {
  id: string;
  role: string;
  organization: Organization;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  currentMembership: OrganizationMembership | null;
  memberships: OrganizationMembership[];
  isLoading: boolean;
  error: string | null;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

// Context
const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

// Provider
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] =
    useState<OrganizationMembership | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemberships = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/user/organizations");

      if (!response.ok) {
        throw new Error("Failed to fetch organizations");
      }

      const data = await response.json();

      if (data.memberships && data.memberships.length > 0) {
        setMemberships(data.memberships);

        // Get stored org ID from localStorage
        const storedOrgId = localStorage.getItem("current_organization_id");
        let selectedOrgId = storedOrgId;

        // Validate stored org ID exists in memberships
        const storedMembership = data.memberships.find(
          (m: OrganizationMembership) => m.organization.id === storedOrgId
        );

        if (!storedMembership) {
          // Fall back to first org
          selectedOrgId = data.memberships[0].organization.id;
        }

        // Set current membership
        const membership = data.memberships.find(
          (m: OrganizationMembership) => m.organization.id === selectedOrgId
        );

        if (membership) {
          setCurrentMembership(membership);
          setCurrentOrg(membership.organization);
          localStorage.setItem("current_organization_id", selectedOrgId!);
        }
      } else {
        // No memberships - user needs to create/join an org
        setMemberships([]);
        setCurrentOrg(null);
        setCurrentMembership(null);
      }
    } catch (err) {
      console.error("Error fetching memberships:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchOrganization = useCallback(
    async (orgId: string) => {
      const membership = memberships.find(
        (m) => m.organization.id === orgId
      );

      if (!membership) {
        console.error("Cannot switch to org - not a member:", orgId);
        return;
      }

      // CRITICAL: Clear any org-scoped localStorage data for the destination org
      // This prevents cross-org data leakage during React state transitions
      // Add any other org-scoped localStorage keys your app uses:
      localStorage.removeItem(`app-state-${orgId}`);
      // Example: localStorage.removeItem(`analytics-conversation-${orgId}`);
      // Example: localStorage.removeItem(`draft-data-${orgId}`);

      // Update state
      setCurrentMembership(membership);
      setCurrentOrg(membership.organization);
      localStorage.setItem("current_organization_id", orgId);

      // Update backend (optional but recommended)
      try {
        await fetch("/api/user/current-organization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_id: orgId }),
        });
      } catch (err) {
        console.error("Error updating current org on server:", err);
      }

      // Reload page to reset all state
      window.location.reload();
    },
    [memberships]
  );

  // Listen for auth changes
  useEffect(() => {
    const supabase = createBrowserSupabase();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchMemberships();
      } else if (event === "SIGNED_OUT") {
        setMemberships([]);
        setCurrentOrg(null);
        setCurrentMembership(null);
        localStorage.removeItem("current_organization_id");
      }
    });

    // Initial fetch
    fetchMemberships();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchMemberships]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        currentMembership,
        memberships,
        isLoading,
        error,
        switchOrganization,
        refreshMemberships: fetchMemberships,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

// Hook
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
```

---

## 2. Auth Context (Optional)

If you want a dedicated auth context separate from organization:

### `src/contexts/AuthContext.tsx`

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createBrowserSupabase();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("current_organization_id");
    window.location.href = "/login";
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

---

## 3. Organization Switcher Component

### `src/components/OrganizationSwitcher.tsx`

```typescript
"use client";

import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";

export function OrganizationSwitcher() {
  const {
    currentOrg,
    memberships,
    isLoading,
    switchOrganization,
  } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-10 w-48 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  if (!currentOrg) {
    return (
      <a
        href="/create-organization"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Create Organization
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
      >
        <span className="font-medium truncate max-w-[150px]">
          {currentOrg.name}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                Organizations
              </p>

              {memberships.map((membership) => (
                <button
                  key={membership.organization.id}
                  onClick={() => {
                    if (membership.organization.id !== currentOrg.id) {
                      switchOrganization(membership.organization.id);
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left ${
                    membership.organization.id === currentOrg.id
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">{membership.organization.name}</span>
                  <span className="text-xs text-gray-500 capitalize">
                    {membership.role}
                  </span>
                </button>
              ))}

              <hr className="my-2" />

              <a
                href="/create-organization"
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-md"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Organization
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 4. Protected Route Wrapper

### `src/components/ProtectedRoute.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrg?: boolean;
  allowedRoles?: string[];
}

export function ProtectedRoute({
  children,
  requireOrg = true,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    currentOrg,
    currentMembership,
    isLoading: orgLoading,
  } = useOrganization();

  const isLoading = authLoading || orgLoading;

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated
    if (!user) {
      router.push("/login");
      return;
    }

    // Requires org but none selected
    if (requireOrg && !currentOrg) {
      router.push("/create-organization");
      return;
    }

    // Role check
    if (allowedRoles && currentMembership) {
      if (!allowedRoles.includes(currentMembership.role)) {
        router.push("/unauthorized");
        return;
      }
    }
  }, [
    user,
    currentOrg,
    currentMembership,
    isLoading,
    requireOrg,
    allowedRoles,
    router,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user) return null;
  if (requireOrg && !currentOrg) return null;

  return <>{children}</>;
}
```

---

## 5. Team Management Components

### `src/components/team/InviteMemberModal.tsx`

```typescript
"use client";

import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const { currentOrg } = useOrganization();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg?.id,
          email,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      setEmail("");
      setRole("member");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Invite Team Member</h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="colleague@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 6. Layout Integration

### `src/app/(dashboard)/layout.tsx`

```typescript
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <ProtectedRoute>
          <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
              <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">Your App</h1>
                <OrganizationSwitcher />
              </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-6">{children}</main>
          </div>
        </ProtectedRoute>
      </OrganizationProvider>
    </AuthProvider>
  );
}
```

---

## 7. Middleware for Auth Protection

### `src/middleware.ts`

```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect logged-in users away from auth pages
  if (
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup") &&
    user
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## 8. Hooks for Common Operations

### `src/hooks/useTeam.ts`

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface TeamMember {
  id: string;
  user_id: string;
  created_at: string;
  role: { id: string; name: string };
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

interface Invitation {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  expires_at: string;
  status: string;
  role: { id: string; name: string };
}

export function useTeam() {
  const { currentOrg } = useOrganization();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!currentOrg) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/team/members?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch team");
      }

      setMembers(data.members || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const changeRole = async (userId: string, newRole: string) => {
    const response = await fetch("/api/team/change-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: currentOrg?.id,
        targetUserId: userId,
        newRole,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to change role");
    }

    await fetchTeam();
  };

  const removeMember = async (userId: string) => {
    const response = await fetch("/api/team/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: currentOrg?.id,
        targetUserId: userId,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to remove member");
    }

    await fetchTeam();
  };

  return {
    members,
    invitations,
    isLoading,
    error,
    refetch: fetchTeam,
    changeRole,
    removeMember,
  };
}
```
