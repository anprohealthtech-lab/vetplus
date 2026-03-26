/*
  # Fix Users Table RLS Policy
  
  This migration corrects the Row Level Security (RLS) policy for the users table.
  The previous policy incorrectly compared auth.uid() (UUID) with email (VARCHAR),
  which would always evaluate to false.
  
  1. Changes
    - Drop the existing incorrect policy
    - Create a new policy that correctly compares auth.uid() with the user's id
    
  2. Security Impact
    - Users will now be able to read their own data as intended
    - Admin access remains unchanged
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can read own data" ON users;

-- Create the corrected policy
CREATE POLICY "Users can read own data" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (id = auth.uid());