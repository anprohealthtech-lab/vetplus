# B2B Portal - Authentication Flow

## Overview
B2B account users are authenticated using Supabase Auth with a dedicated edge function that creates users with special metadata.

## Authentication Architecture

### 1. User Creation (Database Function)
**Edge Function**: `create-b2b-user`
**Location**: `supabase/functions/create-b2b-user/index.ts`

**What it does:**
1. Creates record in `auth.users` table with:
   - Email and password
   - `user_metadata`:
     ```json
     {
       "role": "b2b_account",
       "account_id": "uuid-of-account",
       "account_name": "Hospital Name",
       "lab_id": "uuid-of-lab"
     }
     ```
2. Optionally creates record in `public.users` table for tracking
3. Returns success with user_id

**Called by**: `src/utils/b2bAuth.ts` → `createB2BAccountUser()`

### 2. Login Flow
**Page**: `/b2b` (`src/pages/B2BLogin.tsx`)

**Steps:**
1. User enters email + password
2. Call `supabase.auth.signInWithPassword()`
3. Check `user.user_metadata.role === 'b2b_account'`
4. If valid, redirect to `/b2b/portal`
5. If not B2B user, sign out and show error

### 3. Portal Access
**Page**: `/b2b/portal` (`src/pages/B2BPortal.tsx`)
**Protected by**: `ProtectedB2BRoute` component

**Steps:**
1. Check if user is authenticated
2. Verify `user.user_metadata.role === 'b2b_account'`
3. Extract `account_id` from `user.user_metadata`
4. Fetch account details from `accounts` table
5. Fetch orders where `order.account_id = user.user_metadata.account_id`

## Data Flow

```
Account Creation Form
    ↓
createB2BAccountUser()
    ↓
Edge Function: create-b2b-user
    ↓
auth.users (with metadata)
    ↓
public.users (optional)
```

```
B2B Login
    ↓
supabase.auth.signInWithPassword()
    ↓
Check user_metadata.role
    ↓
Redirect to Portal
    ↓
Load account data
    ↓
Load orders (filtered by account_id)
```

## Security

### Row Level Security (RLS)
**Required Policy** (to be added):
```sql
-- Policy for orders table
CREATE POLICY "B2B users can only see their account's orders"
ON orders
FOR SELECT
TO authenticated
USING (
  account_id = (
    (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid
  )
);

-- Policy for reports table (via orders)
CREATE POLICY "B2B users can access reports for their orders"
ON reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = reports.order_id
    AND orders.account_id = (
      (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid
    )
  )
);
```

### Authentication Checks
1. **Login**: Verifies `role === 'b2b_account'`
2. **Protected Route**: Checks authentication + role
3. **Data Fetching**: Uses `account_id` from metadata
4. **RLS**: Database-level security (when policies added)

## Helper Functions

### `src/utils/b2bAuth.ts`

```typescript
// Create B2B user (calls edge function)
createB2BAccountUser(accountData)

// Check if current user is B2B
isB2BUser() → boolean

// Get current B2B account ID
getCurrentB2BAccountId() → string | null

// Get full account details
getCurrentB2BAccount() → Account | null
```

## Comparison with Lab Users

| Feature | Lab Users | B2B Users |
|---------|-----------|-----------|
| **Edge Function** | `create-auth-user` | `create-b2b-user` |
| **Role** | admin, technician, doctor | b2b_account |
| **Metadata** | lab_id, role_id, name | account_id, account_name, lab_id |
| **Public Users** | Full record required | Optional record |
| **Access** | Full LIMS app | B2B Portal only |
| **Data Scope** | Lab-wide | Account-specific |

## Implementation Status

✅ Edge function created: `create-b2b-user`
✅ Edge function deployed
✅ Auth utilities created: `b2bAuth.ts`
✅ Login page created: `B2BLogin.tsx`
✅ Portal page created: `B2BPortal.tsx`
✅ Protected route created: `ProtectedB2BRoute.tsx`
⏳ RLS policies (to be added)
⏳ Account creation form integration (Phase 5)

## Testing

### Manual Test:
1. Call edge function directly:
```bash
curl -X POST https://api.limsapp.in/functions/v1/create-b2b-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "test@hospital.com",
    "password": "TestPass123!",
    "account_id": "uuid-of-account",
    "account_name": "Test Hospital",
    "lab_id": "uuid-of-lab"
  }'
```

2. Login at `/b2b` with created credentials
3. Verify portal access and data visibility

## Next Steps

1. **Add RLS Policies** - Secure data access at database level
2. **Update Account Form** - Add portal access fields
3. **Integrate Creation** - Call `createB2BAccountUser()` on account save
4. **Test End-to-End** - Create account → Login → View orders
5. **Add Password Reset** - Forgot password flow for B2B users
