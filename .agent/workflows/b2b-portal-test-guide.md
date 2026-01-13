# B2B Portal - Quick Test Guide

## Test 1: Create B2B Account

1. Login to LIMS as lab admin
2. Go to **Account Master** (`/masters/accounts`)
3. Click **"Add Account"**
4. Fill in:
   - Name: "Test Hospital"
   - Code: "TH001"
   - Type: "Hospital"
   - Email: "test@hospital.com"
   - Phone: "1234567890"
5. Check **"Enable B2B Portal Access"**
6. Enter:
   - Portal Email: "portal@testhospital.com"
   - Portal Password: "TestPass123!"
7. Click **"Save"**
8. Note the success message with portal URL

## Test 2: Login as B2B User

1. **Logout** from lab admin account
2. Navigate to `/b2b`
3. Enter:
   - Email: "portal@testhospital.com"
   - Password: "TestPass123!"
4. Click **"Sign In"**
5. Should redirect to `/b2b/portal`

## Test 3: Verify Portal Access

1. Check **Account Info Card**:
   - Should show "Test Hospital"
   - Should show account details
   - Click to expand/collapse

2. Check **Orders Table**:
   - Should show only orders for Test Hospital
   - Should NOT show orders from other accounts

3. Try **Filters**:
   - Search by sample ID
   - Filter by status
   - Set date range
   - Click refresh

4. Try **Download Report**:
   - Find an order with report ready
   - Click "Download Report"
   - Should download PDF

## Test 4: Verify Security (IMPORTANT!)

### Test 4A: Cannot Access LIMS Pages
Try navigating to these URLs (should all redirect to `/b2b`):
- `/dashboard` ❌
- `/patients` ❌
- `/orders` ❌
- `/results` ❌
- `/results2` ❌
- `/tests` ❌
- `/settings` ❌
- `/billing` ❌
- `/user-management` ❌

### Test 4B: Cannot See Other Accounts' Data
1. Create another account (Account B) with different orders
2. Login as Account A's B2B user
3. Verify you CANNOT see Account B's orders
4. Verify you CANNOT see Account B's reports

### Test 4C: Cannot Modify Data
Open browser console and try:
```javascript
// Try to create an order (should fail)
await supabase.from('orders').insert({...})

// Try to update an order (should fail)
await supabase.from('orders').update({...}).eq('id', '...')

// Try to delete an order (should fail)
await supabase.from('orders').delete().eq('id', '...')

// Try to access patients (should return empty)
await supabase.from('patients').select('*')

// Try to access users (should return empty)
await supabase.from('users').select('*')

// Try to access labs (should return empty)
await supabase.from('labs').select('*')
```

All should fail or return empty results.

## Test 5: Logout and Re-login

1. Click **"Logout"** button
2. Should redirect to `/b2b` login page
3. Login again with same credentials
4. Should work and show same data

## Expected Results

### ✅ Should Work:
- [x] Create account with portal access
- [x] B2B user can login at `/b2b`
- [x] B2B user sees their account info
- [x] B2B user sees their orders only
- [x] B2B user can filter/search orders
- [x] B2B user can download reports
- [x] B2B user can logout

### ❌ Should Fail:
- [x] B2B user accessing `/dashboard`
- [x] B2B user accessing any LIMS page
- [x] B2B user seeing other accounts' data
- [x] B2B user modifying any data
- [x] B2B user accessing patient info
- [x] B2B user accessing lab settings

## Troubleshooting

### Issue: "User with this email already exists"
**Solution**: Email is already used. Use a different email or delete the existing auth user.

### Issue: B2B user can access LIMS pages
**Solution**: 
1. Check `ProtectedB2BRoute` is working
2. Verify user metadata has `role: 'b2b_account'`
3. Check browser console for errors

### Issue: B2B user sees no orders
**Solution**:
1. Create test orders with `account_id` set to the test account
2. Verify RLS policies are applied
3. Check user's `account_id` in metadata matches

### Issue: RLS policies not working
**Solution**:
1. Run the migration file: `supabase db push`
2. Verify RLS is enabled on tables
3. Check policies in Supabase dashboard

## Quick SQL Queries for Testing

### Check if B2B user exists:
```sql
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'account_id' as account_id
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'b2b_account';
```

### Check account's orders:
```sql
SELECT 
  o.id,
  o.sample_id,
  o.patient_name,
  o.status,
  o.account_id,
  a.name as account_name
FROM orders o
LEFT JOIN accounts a ON a.id = o.account_id
WHERE o.account_id = 'YOUR_ACCOUNT_ID';
```

### Check RLS policies:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('orders', 'reports', 'accounts', 'patients', 'users')
ORDER BY tablename, policyname;
```

## Success Criteria

✅ **All tests pass**
✅ **B2B users isolated from LIMS**
✅ **Data access restricted to account only**
✅ **No write access for B2B users**
✅ **Security enforced at all levels**

---

**Time to Complete**: ~15 minutes
**Prerequisites**: Lab admin access, test account created
**Tools Needed**: Browser, Supabase dashboard access
