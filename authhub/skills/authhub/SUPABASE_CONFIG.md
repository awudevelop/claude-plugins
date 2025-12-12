# Supabase Project Configuration

Settings to configure in your Supabase project dashboard for AuthHub to work properly.

## 1. Authentication Settings

### Navigate to: Authentication → Providers

#### Email Provider
- **Enable Email provider**: ON
- **Confirm email**: Recommended ON for production, OFF for development
- **Secure email change**: ON
- **Double confirm email changes**: ON (production)

#### Phone Provider (if using phone-based invitations)
- **Enable Phone provider**: ON
- **SMS Provider**: Choose Twilio, MessageBird, or Vonage
- Configure your SMS provider credentials

### Navigate to: Authentication → URL Configuration

```
Site URL: https://your-app.com (or http://localhost:3000 for dev)

Redirect URLs (add all of these):
- http://localhost:3000/**
- https://your-app.com/**
- https://your-app.vercel.app/**
```

### Navigate to: Authentication → Email Templates

Customize these templates:

#### Confirm Signup
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

#### Invite User
```html
<h2>You've been invited</h2>
<p>You've been invited to join {{ .SiteURL }}.</p>
<p><a href="{{ .ConfirmationURL }}">Accept invitation</a></p>
```

#### Magic Link
```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

#### Reset Password
```html
<h2>Reset Password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

---

## 2. Database Settings

### Navigate to: Database → Extensions

Enable these extensions:
- **uuid-ossp** - For UUID generation (usually enabled by default)
- **pgcrypto** - For secure token generation

### Navigate to: SQL Editor

Run the database schema from [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

---

## 3. API Settings

### Navigate to: Settings → API

Note these values for your `.env.local`:

```env
# Public (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# Private (server-side only - NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

### JWT Settings
- **JWT expiry**: 3600 (1 hour) is default, adjust as needed
- **JWT Secret**: Auto-generated, don't change unless necessary

---

## 4. Storage Settings (Optional)

If storing user avatars or organization logos:

### Navigate to: Storage → Buckets

Create bucket: `avatars`
- **Public bucket**: ON (for profile pictures)
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`

### Storage Policies

```sql
-- Allow users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow users to update/delete their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 5. Edge Functions (Optional)

For invitation emails, webhooks, etc.

### Navigate to: Edge Functions

You can deploy edge functions for:
- Sending custom invitation emails
- Webhook handlers
- Scheduled cleanup of expired invitations

Example invitation email function:

```typescript
// supabase/functions/send-invitation/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { email, inviterName, orgName, inviteUrl } = await req.json()

  // Send email via your preferred provider (Resend, SendGrid, etc.)
  // ...

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

---

## 6. Realtime (Optional)

For live org switching notifications:

### Navigate to: Database → Replication

Enable replication for tables you want real-time updates:
- `user_role_assignments` - When roles change
- `invites` - When invitations are accepted

---

## 7. Security Checklist

### Before Going to Production

- [ ] **Enable RLS** on all AuthHub tables
- [ ] **Disable public schema access** in API settings (if not using RLS)
- [ ] **Set strong JWT secret** (auto-generated is fine)
- [ ] **Configure rate limiting** in Authentication settings
- [ ] **Enable email confirmation** for signups
- [ ] **Review API keys** - rotate if ever exposed
- [ ] **Set up monitoring** in Supabase dashboard

### Environment Variables Checklist

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional - for email/SMS
RESEND_API_KEY=           # For invitation emails
TWILIO_ACCOUNT_SID=       # For SMS invitations
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

## 8. Local Development

### Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Pull remote schema
supabase db pull

# Create new migration
supabase migration new authhub_setup

# Apply migrations
supabase db push
```

### Using Local Supabase (Optional)

```bash
# Start local Supabase
supabase start

# Local URLs will be displayed:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
```

---

## 9. Troubleshooting

### Common Issues

**"JWT expired" errors**
- Check JWT expiry setting in Authentication → Settings
- Ensure client refreshes tokens properly

**"permission denied for table" errors**
- RLS is enabled but policies are missing
- Check that service role key is used for admin operations

**"duplicate key" errors on signup**
- User profile trigger may be firing twice
- Add `ON CONFLICT` clause to handle duplicates

**Invitations not being sent**
- Check email provider configuration
- Verify redirect URLs are correct
- Check edge function logs if using custom emails
