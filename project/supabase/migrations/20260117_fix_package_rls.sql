
-- Enable RLS on package_test_groups table
ALTER TABLE "public"."package_test_groups" ENABLE ROW LEVEL SECURITY;

-- Allow read access for all users (or restrict as needed)
CREATE POLICY "Enable read access for all users" ON "public"."package_test_groups"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

-- Ensure nested test_groups are also readable if not already
CREATE POLICY "Enable read access for all users" ON "public"."test_groups"
AS PERMISSIVE FOR SELECT
TO public
USING (true);
