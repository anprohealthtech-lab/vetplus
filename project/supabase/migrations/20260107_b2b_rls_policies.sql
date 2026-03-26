-- B2B Portal Security - Row Level Security Policies
-- These policies ensure B2B account users can ONLY access their own data
-- and have NO access to the lab's LIMS system

-- ============================================
-- 1. ORDERS TABLE - B2B users can only see their account's orders
-- ============================================

CREATE POLICY "b2b_users_view_own_orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Check if user is a B2B account user
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'b2b_account'
  AND
  -- Only show orders for their account
  account_id = ((auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid)
);

-- Prevent B2B users from inserting, updating, or deleting orders
CREATE POLICY "b2b_users_no_write_orders"
ON orders
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 2. REPORTS TABLE - B2B users can only see reports for their orders
-- ============================================

CREATE POLICY "b2b_users_view_own_reports"
ON reports
FOR SELECT
TO authenticated
USING (
  -- Check if user is a B2B account user
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'b2b_account'
  AND
  -- Only show reports for orders belonging to their account
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = reports.order_id
    AND orders.account_id = ((auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid)
  )
);

-- Prevent B2B users from modifying reports
CREATE POLICY "b2b_users_no_write_reports"
ON reports
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 3. ACCOUNTS TABLE - B2B users can only see their own account
-- ============================================

CREATE POLICY "b2b_users_view_own_account"
ON accounts
FOR SELECT
TO authenticated
USING (
  -- Check if user is a B2B account user
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'b2b_account'
  AND
  -- Only show their own account
  id = ((auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid)
);

-- Prevent B2B users from modifying accounts
CREATE POLICY "b2b_users_no_write_accounts"
ON accounts
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 4. PATIENTS TABLE - B2B users CANNOT access patient data
-- ============================================

CREATE POLICY "b2b_users_no_access_patients"
ON patients
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 5. USERS TABLE - B2B users CANNOT access lab users
-- ============================================

CREATE POLICY "b2b_users_no_access_users"
ON users
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 6. TEST_GROUPS TABLE - B2B users CANNOT access test configurations
-- ============================================

CREATE POLICY "b2b_users_no_access_test_groups"
ON test_groups
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 7. LABS TABLE - B2B users CANNOT access lab settings
-- ============================================

CREATE POLICY "b2b_users_no_access_labs"
ON labs
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 8. RESULTS TABLE - B2B users CANNOT access raw result data
-- ============================================

CREATE POLICY "b2b_users_no_access_results"
ON results
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 9. RESULT_VALUES TABLE - B2B users CANNOT access result values
-- ============================================

CREATE POLICY "b2b_users_no_access_result_values"
ON result_values
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- SUMMARY OF B2B USER PERMISSIONS
-- ============================================

-- ✅ CAN ACCESS:
--    - Their own account information (read-only)
--    - Orders for their account (read-only)
--    - Reports for their orders (read-only, PDF download)

-- ❌ CANNOT ACCESS:
--    - Patient personal information
--    - Lab users and staff
--    - Test configurations
--    - Lab settings
--    - Raw result data
--    - Any other lab's data
--    - Any other account's data

-- ❌ CANNOT MODIFY:
--    - Cannot create, update, or delete ANY data
--    - Read-only access to their permitted data only

-- ============================================
-- DEPLOYMENT INSTRUCTIONS
-- ============================================

-- 1. Run this migration file to create all policies
-- 2. Verify RLS is enabled on all tables:
--    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE test_groups ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE results ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE result_values ENABLE ROW LEVEL SECURITY;

-- 3. Test with a B2B user account:
--    - Login to /b2b portal
--    - Verify can see only their orders
--    - Verify cannot access /dashboard or other LIMS pages
--    - Verify cannot access other accounts' data

-- ============================================
-- TESTING QUERIES
-- ============================================

-- Test as B2B user (run these in SQL editor while logged in as B2B user):

-- Should return only their account's orders:
-- SELECT * FROM orders;

-- Should return only their reports:
-- SELECT * FROM reports;

-- Should return only their account:
-- SELECT * FROM accounts;

-- Should return NOTHING (no access):
-- SELECT * FROM patients;
-- SELECT * FROM users;
-- SELECT * FROM test_groups;
-- SELECT * FROM labs;
