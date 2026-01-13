---
description: B2B Portal Implementation Plan
---

# B2B Portal Implementation Plan

## Overview
Create a single-page B2B portal where account users (hospitals, corporates, clinics) can:
1. View their account information
2. See registered samples/orders
3. Track order status
4. Download PDF reports

## Database Schema Analysis

### Existing Tables (No new fields needed)
- `accounts` - Already has all account info (name, code, type, email, phone, address, credit_limit, etc.)
- `orders` - Has `account_id` field to link orders to accounts
- `reports` - Has `order_id` to link reports
- `users` - For authentication (will create auth users for B2B accounts)

### Key Fields Already Available
```sql
accounts:
  - id, lab_id, name, code, type
  - billing_email, billing_phone
  - address_line1, address_line2, city, state, pincode
  - credit_limit, payment_terms
  - default_discount_percent
  - is_active, created_at

orders (filtered by account_id):
  - id, patient_name, patient_id
  - status, priority
  - order_date, expected_date
  - total_amount
  - sample_id, color_code, color_name
  - account_id (CRITICAL FIELD)

reports (via orders):
  - id, order_id
  - pdf_url, pdf_path
  - status, generated_at
```

## Implementation Plan

### Phase 1: Authentication Setup

#### 1.1 Add Password Field to Account Creation Form
**File**: `src/pages/Billing.tsx` or Account Form Component
- Add password input field (optional, only for B2B portal access)
- Add "Enable Portal Access" checkbox
- Store password securely (will be used to create auth user)

#### 1.2 Create Auth User Helper Function
**File**: `src/utils/b2bAuth.ts` (NEW)
```typescript
// Helper to create auth user for B2B account
export async function createB2BAccountUser(accountData: {
  email: string;
  password: string;
  accountId: string;
  accountName: string;
}) {
  // Call create-auth-user edge function
  // Set user_metadata with account_id and role: 'b2b_account'
}
```

### Phase 2: B2B Portal Page

#### 2.1 Create Single Portal Page
**File**: `src/pages/B2BPortal.tsx` (NEW)

**Layout**:
```
┌─────────────────────────────────────────┐
│  Header: Account Name & Logo            │
├─────────────────────────────────────────┤
│  Account Info Card (Collapsible)        │
│  - Name, Code, Type                     │
│  - Contact Info                         │
│  - Credit Limit, Payment Terms          │
│  - Address                              │
├─────────────────────────────────────────┤
│  Orders/Samples Table                   │
│  ┌───────────────────────────────────┐  │
│  │ Filters: Status, Date Range       │  │
│  ├───────────────────────────────────┤  │
│  │ Sample ID | Patient | Status |    │  │
│  │ Date | Amount | Actions           │  │
│  │ ─────────────────────────────────│  │
│  │ 05-Jan-001 | John | Completed |   │  │
│  │ [View Report] [Track]             │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Components to Reuse**:
1. **OrderStatusDisplay** - For status badges
2. **SampleTypeIndicator** - For sample color indicators
3. Existing table/card components from Orders page

**Features**:
- **Account Info Section** (top, collapsible)
  - Display account details from `accounts` table
  - Show credit limit, outstanding balance
  - Contact information

- **Orders Table** (main section)
  - Filter by status (Pending, In Progress, Completed, Delivered)
  - Date range filter
  - Search by sample ID or patient name
  - Columns:
    - Sample ID (with color indicator)
    - Patient Name
    - Order Date
    - Expected Date
    - Status (badge)
    - Amount
    - Actions (View Report, Track Status)

- **Report Download**
  - Show "Download Report" button only when status = "Report Ready" or "Completed"
  - Use existing `reports.pdf_url` to download
  - Show report generation date

- **Order Tracking**
  - Reuse workflow steps from OrderDetailsModal
  - Show simple timeline: Registered → Sample Collected → In Progress → Report Ready → Delivered

#### 2.2 Data Fetching Logic
```typescript
// Get current B2B user's account_id from auth.users.user_metadata
const { data: { user } } = await supabase.auth.getUser();
const accountId = user?.user_metadata?.account_id;

// Fetch account info
const { data: account } = await supabase
  .from('accounts')
  .select('*')
  .eq('id', accountId)
  .single();

// Fetch orders for this account
const { data: orders } = await supabase
  .from('orders')
  .select(`
    *,
    patients(name, phone),
    reports(id, pdf_url, status, generated_at)
  `)
  .eq('account_id', accountId)
  .order('order_date', { ascending: false });
```

### Phase 3: Authentication & Routing

#### 3.1 Create B2B Login Page
**File**: `src/pages/B2BLogin.tsx` (NEW)
- Simple login form (email + password)
- Use supabase.auth.signInWithPassword()
- Redirect to B2BPortal on success
- Check user_metadata.role === 'b2b_account'

#### 3.2 Add Route
**File**: `src/App.tsx`
```typescript
<Route path="/b2b" element={<B2BLogin />} />
<Route path="/b2b/portal" element={<ProtectedB2BRoute><B2BPortal /></ProtectedB2BRoute>} />
```

#### 3.3 Protected Route Component
**File**: `src/components/Auth/ProtectedB2BRoute.tsx` (NEW)
- Check if user is authenticated
- Check if user.user_metadata.role === 'b2b_account'
- Redirect to /b2b login if not

### Phase 4: Account Creation Flow Update

#### 4.1 Update Account Form
**File**: Existing account creation form
Add fields:
```typescript
- Enable Portal Access: boolean (checkbox)
- Portal Email: string (required if portal enabled)
- Portal Password: string (required if portal enabled, min 8 chars)
```

#### 4.2 On Account Save
```typescript
if (enablePortalAccess) {
  // Create auth user
  await createB2BAccountUser({
    email: portalEmail,
    password: portalPassword,
    accountId: newAccount.id,
    accountName: newAccount.name
  });
  
  // Show success message with login URL
  alert(`Account created! Portal access enabled at: ${window.location.origin}/b2b`);
}
```

## Minimal Required Functionality

### Must Have:
1. ✅ Login page for B2B accounts
2. ✅ Account info display (read-only)
3. ✅ Orders list with filters (status, date)
4. ✅ Order status tracking
5. ✅ PDF report download (when available)
6. ✅ Logout functionality

### Nice to Have (Future):
- Invoice download
- Payment history
- Outstanding balance tracking
- Email notifications
- Mobile responsive design

## Files to Create:

1. `src/pages/B2BLogin.tsx` - Login page
2. `src/pages/B2BPortal.tsx` - Main portal page
3. `src/components/Auth/ProtectedB2BRoute.tsx` - Route guard
4. `src/utils/b2bAuth.ts` - Auth helper functions
5. `src/components/B2B/AccountInfoCard.tsx` - Account info display
6. `src/components/B2B/OrdersTable.tsx` - Orders table with filters

## Files to Modify:

1. `src/App.tsx` - Add routes
2. Account creation form - Add portal access fields
3. Account creation handler - Call auth user creation

## Database Views to Use:

No new views needed! Use existing:
- `accounts` table directly
- `orders` table with `account_id` filter
- `reports` table via `order_id` join

## Security Considerations:

1. **Row Level Security (RLS)**:
   - Ensure B2B users can only see their own account's orders
   - Add RLS policy: `account_id = auth.jwt() ->> 'account_id'`

2. **User Metadata**:
   ```json
   {
     "role": "b2b_account",
     "account_id": "uuid",
     "account_name": "Hospital Name"
   }
   ```

3. **Password Requirements**:
   - Minimum 8 characters
   - At least one uppercase, lowercase, number

## UI/UX Design:

- Clean, professional design
- Mobile-first responsive
- Use existing color scheme
- Reuse components from main app for consistency
- Simple navigation (no complex menus)

## Testing Checklist:

- [ ] B2B user can login
- [ ] B2B user sees only their account's orders
- [ ] Status filters work correctly
- [ ] Date range filter works
- [ ] PDF download works
- [ ] Order tracking shows correct status
- [ ] Logout works
- [ ] Cannot access other accounts' data
- [ ] Mobile responsive

## Deployment Notes:

1. Deploy edge function for auth user creation (if not exists)
2. Add RLS policies for B2B access
3. Test with sample B2B account
4. Document login URL for customers

## Timeline Estimate:

- Phase 1 (Auth Setup): 2 hours
- Phase 2 (Portal Page): 4 hours
- Phase 3 (Routing & Auth): 2 hours
- Phase 4 (Account Form Update): 1 hour
- Testing & Polish: 2 hours

**Total: ~11 hours** (1-2 days)
