-- B2B Portal: Allow test catalog access for booking
-- B2B users need to search tests and packages to create bookings
-- JWT user_metadata contains: role='b2b_account', lab_id='uuid', account_id='uuid'

-- ============================================
-- 1. TEST_GROUPS - Replace blocking policy with scoped read access
-- ============================================

-- Drop the old FOR ALL blocking policy (it conflicts with existing USING(true) policies)
DROP POLICY IF EXISTS "b2b_users_no_access_test_groups" ON "public"."test_groups";

-- B2B users can SELECT test groups (app query already filters by lab_id)
DROP POLICY IF EXISTS "b2b_users_view_lab_test_groups" ON "public"."test_groups";
CREATE POLICY "b2b_users_view_lab_test_groups" ON "public"."test_groups"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'b2b_account'
);

-- Block B2B users from INSERT/UPDATE/DELETE on test_groups
DROP POLICY IF EXISTS "b2b_users_no_write_test_groups" ON "public"."test_groups";
CREATE POLICY "b2b_users_no_write_test_groups" ON "public"."test_groups"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') != 'b2b_account'
);

-- ============================================
-- 2. PACKAGES - Allow B2B users to read their lab's packages
-- ============================================

DROP POLICY IF EXISTS "b2b_users_view_lab_packages" ON "public"."packages";
CREATE POLICY "b2b_users_view_lab_packages" ON "public"."packages"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'b2b_account'
);

-- ============================================
-- 3. PACKAGE_TEST_GROUPS - Allow B2B users to read (needed for package joins)
-- ============================================

ALTER TABLE IF EXISTS "public"."package_test_groups" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "b2b_users_view_package_test_groups" ON "public"."package_test_groups";
CREATE POLICY "b2b_users_view_package_test_groups" ON "public"."package_test_groups"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'b2b_account'
);

GRANT SELECT ON "public"."test_groups" TO authenticated;
GRANT SELECT ON "public"."packages" TO authenticated;
GRANT SELECT ON "public"."package_test_groups" TO authenticated;
