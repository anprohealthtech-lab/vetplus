---
description: Implementation plan for paid subscription plans with Razorpay integration and new lab onboarding flow
---

# Simplified Paid Plan & Lab Onboarding Implementation Plan

## 🎯 Goals (Simplified)

1. **Labs table** - Add subscription status columns + Razorpay columns
2. **Login-level check** - Block access if lab is inactive/expired
3. **Onboarding page** - New lab + admin user creation
4. **Razorpay integration** - Payment processing for activation

---

## 🗄️ Database Changes (Labs Table Only)

### New Columns in `labs` Table

```sql
-- ================================================
-- SUBSCRIPTION STATUS COLUMNS
-- ================================================

-- Plan status: active means lab can use the system
ALTER TABLE labs ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trial'
  CHECK (plan_status IN ('trial', 'active', 'inactive', 'suspended'));

-- When the plan expires (NULL = never expires for lifetime deals)
ALTER TABLE labs ADD COLUMN IF NOT EXISTS active_upto TIMESTAMPTZ;

-- When the trial/plan started
ALTER TABLE labs ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT now();

-- ================================================
-- RAZORPAY INTEGRATION COLUMNS
-- ================================================

-- Razorpay customer ID (created on first payment)
ALTER TABLE labs ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- Last successful payment ID
ALTER TABLE labs ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- Last payment amount
ALTER TABLE labs ADD COLUMN IF NOT EXISTS razorpay_last_amount NUMERIC;

-- Last payment date
ALTER TABLE labs ADD COLUMN IF NOT EXISTS razorpay_last_payment_at TIMESTAMPTZ;

-- ================================================
-- BILLING/CONTACT INFO (Optional but useful)
-- ================================================

-- Billing email (for invoices)
ALTER TABLE labs ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- GSTIN for invoices
ALTER TABLE labs ADD COLUMN IF NOT EXISTS gstin TEXT;

-- ================================================
-- INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_labs_plan_status ON labs(plan_status);
CREATE INDEX IF NOT EXISTS idx_labs_active_upto ON labs(active_upto);
```

### Plan Status Values

| Status | Meaning | Can Use System? |
|--------|---------|-----------------|
| `trial` | New lab, free trial period | ✅ Yes |
| `active` | Paid and active | ✅ Yes |
| `inactive` | Expired, needs payment | ❌ No |
| `suspended` | Manually suspended by admin | ❌ No |

---

## 🔐 Login-Level Check Implementation

### Option 1: Check in AuthContext (Frontend)

In `src/contexts/AuthContext.tsx`, after user logs in:

```typescript
// After successful login, check lab status
const checkLabStatus = async (userId: string) => {
  // Get user's lab
  const { data: userData } = await supabase
    .from('users')
    .select('lab_id')
    .eq('auth_user_id', userId)
    .single();
  
  if (!userData?.lab_id) return { canAccess: false, reason: 'no_lab' };
  
  // Check lab status
  const { data: labData } = await supabase
    .from('labs')
    .select('plan_status, active_upto, name')
    .eq('id', userData.lab_id)
    .single();
  
  if (!labData) return { canAccess: false, reason: 'lab_not_found' };
  
  // Check if active
  if (labData.plan_status === 'inactive' || labData.plan_status === 'suspended') {
    return { canAccess: false, reason: 'inactive', labName: labData.name };
  }
  
  // Check if expired
  if (labData.active_upto && new Date(labData.active_upto) < new Date()) {
    return { canAccess: false, reason: 'expired', labName: labData.name };
  }
  
  return { canAccess: true };
};
```

### Option 2: RLS Policy (Database Level)

```sql
-- Add RLS policy to block inactive labs from reading data
CREATE POLICY "Block inactive labs" ON orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM labs 
    WHERE labs.id = orders.lab_id 
    AND labs.plan_status IN ('trial', 'active')
    AND (labs.active_upto IS NULL OR labs.active_upto > now())
  )
);
```

### Recommended: Both

- Frontend check for nice UX (redirect to payment page)
- RLS policy as backend safety net

---

## 📄 New Onboarding Flow

### Route: `/onboard`

**Step 1: Lab Information**
- Lab name, code
- Address, city, state, pincode
- Phone, email
- License number (optional)

**Step 2: Admin User Information**
- Full name
- Email
- Password
- Phone (optional)

**Step 3: Payment (Razorpay)**
- Show pricing
- Initialize Razorpay checkout
- Process payment

**Step 4: Confirmation**
- Lab created
- Login credentials
- Redirect to /login

---

## 🔧 Edge Functions Needed

### 1. `create-lab-with-admin`

Creates lab and admin user in one transaction.

**Input:**
```json
{
  "lab": {
    "name": "Test Lab",
    "code": "TESTLAB",
    "address": "...",
    "city": "...",
    "state": "...",
    "pincode": "...",
    "phone": "...",
    "email": "..."
  },
  "admin": {
    "name": "John Doe",
    "email": "john@testlab.com",
    "password": "securepassword",
    "phone": "9876543210"
  },
  "razorpay_payment_id": "pay_xxx" // Optional, if payment done
}
```

**Flow:**
1. Validate input
2. Create lab record with:
   - `plan_status = 'trial'` (or 'active' if payment provided)
   - `active_upto = now() + 14 days` (trial) or `now() + 1 year` (paid)
   - Razorpay payment details if provided
3. Create auth.user via Supabase Admin API
4. Create public.users record with role = 'Administrator'
5. Call onboarding-lab to hydrate tests/templates
6. Return success

### 2. `create-razorpay-order`

Creates a Razorpay order for payment.

**Input:**
```json
{
  "amount": 9999,
  "lab_name": "Test Lab",
  "email": "john@testlab.com"
}
```

**Output:**
```json
{
  "order_id": "order_xxx",
  "amount": 9999,
  "currency": "INR",
  "key_id": "rzp_xxx"
}
```

### 3. `verify-razorpay-payment`

Verifies payment signature after checkout.

**Input:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "xxx"
}
```

### 4. `activate-lab-subscription`

Activates/extends lab subscription after payment.

**Input:**
```json
{
  "lab_id": "uuid",
  "razorpay_payment_id": "pay_xxx",
  "amount": 9999,
  "extend_days": 365
}
```

---

## 📱 Frontend Components

### 1. Onboarding Page
`src/pages/Onboarding.tsx`
- Multi-step wizard
- Form validation
- Payment integration

### 2. Subscription Status Banner
`src/components/SubscriptionBanner.tsx`
- Shows days remaining
- "Renew Now" button
- Appears when < 7 days left

### 3. Inactive Lab Page
`src/pages/InactiveLab.tsx`
- Shown when lab is inactive/expired
- Payment option to reactivate
- Contact support link

### 4. Razorpay Checkout Hook
`src/hooks/useRazorpay.ts`
- Initialize Razorpay
- Handle payment callbacks

---

## 🔄 Updated App Flow

```
User visits /login
    ↓
Login successful
    ↓
AuthContext checks lab status
    ↓
├── Lab active → Continue to Dashboard
│
├── Lab in trial (< 7 days) → Show warning banner
│
├── Lab expired → Redirect to /renew
│
└── Lab inactive/suspended → Redirect to /inactive
```

---

## 🔐 Environment Variables

```env
# Razorpay (add to Supabase secrets)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx

# Trial settings
TRIAL_DAYS=14
YEARLY_PRICE=9999
```

---

## ✅ Implementation Checklist

### Phase 1: Database
- [ ] Add columns to labs table (migration)
- [ ] Update existing labs with default values

### Phase 2: Login Check
- [ ] Update AuthContext with lab status check
- [ ] Create InactiveLab page
- [ ] Create SubscriptionBanner component

### Phase 3: Onboarding
- [ ] Create Onboarding page
- [ ] Create create-lab-with-admin edge function
- [ ] Add /onboard route

### Phase 4: Razorpay
- [ ] Create create-razorpay-order function
- [ ] Create verify-razorpay-payment function
- [ ] Add Razorpay checkout to frontend
- [ ] Create activate-lab-subscription function

### Phase 5: Testing
- [ ] Test new lab signup (trial)
- [ ] Test payment flow
- [ ] Test login blocking for inactive labs
- [ ] Test existing lab logins

---

## 📝 Quick Reference

**To check if a lab can access the system:**
```sql
SELECT 
  id, name, plan_status, active_upto,
  CASE 
    WHEN plan_status IN ('inactive', 'suspended') THEN false
    WHEN active_upto IS NOT NULL AND active_upto < now() THEN false
    ELSE true
  END AS can_access
FROM labs
WHERE id = 'your-lab-id';
```

**To extend a lab's subscription:**
```sql
UPDATE labs SET
  plan_status = 'active',
  active_upto = COALESCE(active_upto, now()) + INTERVAL '1 year',
  razorpay_payment_id = 'pay_xxx',
  razorpay_last_amount = 9999,
  razorpay_last_payment_at = now()
WHERE id = 'your-lab-id';
```

**To suspend a lab manually:**
```sql
UPDATE labs SET plan_status = 'suspended' WHERE id = 'your-lab-id';
```
