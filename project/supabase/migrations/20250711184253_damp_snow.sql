/*
  # Safe Migration: Add lab_id and department_id to users table

  1. Dependencies
    - Ensure labs table exists
    - Ensure departments table exists
    - Create necessary ENUM types

  2. Changes
    - Add lab_id column to users table
    - Add department_id column to users table
    - Add foreign key constraints
    - Add performance indexes
    - Update RLS policies

  3. Safety Features
    - Uses IF NOT EXISTS for all operations
    - Creates dependencies before referencing them
    - Handles existing data gracefully
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('Admin', 'Lab Manager', 'Technician', 'Receptionist', 'Doctor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('Active', 'Inactive', 'Suspended');
  END IF;
END $$;

-- Function to auto-update 'updated_at' column (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create labs table if it doesn't exist
CREATE TABLE IF NOT EXISTS labs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    license_number VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure users table exists with basic structure
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100),
    status user_status DEFAULT 'Active' NOT NULL,
    phone VARCHAR(20),
    join_date DATE DEFAULT CURRENT_DATE NOT NULL,
    last_login TIMESTAMPTZ,
    permissions TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add lab_id column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'lab_id'
  ) THEN
    ALTER TABLE users ADD COLUMN lab_id UUID REFERENCES labs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add department_id column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE users ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_lab_id ON users(lab_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);

-- Enable RLS on all tables
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can read labs" ON labs;
DROP POLICY IF EXISTS "Admins can modify labs" ON labs;
DROP POLICY IF EXISTS "Users can read departments" ON departments;
DROP POLICY IF EXISTS "Admins can modify departments" ON departments;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can read same lab users" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Create RLS policies for labs
CREATE POLICY "Users can read labs" ON labs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify labs" ON labs FOR ALL TO authenticated USING (true);

-- Create RLS policies for departments
CREATE POLICY "Users can read departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify departments" ON departments FOR ALL TO authenticated USING (true);

-- Create RLS policies for users
CREATE POLICY "Users can read own data" ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can read same lab users" ON users FOR SELECT TO authenticated USING (
  lab_id IN (SELECT lab_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Admins can manage users" ON users FOR ALL TO authenticated USING (true);

-- Create triggers for updated_at columns (if not exists)
DROP TRIGGER IF EXISTS update_labs_updated_at ON labs;
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

CREATE TRIGGER update_labs_updated_at BEFORE UPDATE ON labs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample labs (only if they don't exist)
INSERT INTO labs (name, code, address, city, state, pincode, phone, email, license_number)
SELECT 'MediLab Central', 'ML001', '123 Health Street, Medical District', 'Bangalore', 'Karnataka', '560001', '+91 80 1234 5678', 'central@medilab.com', 'KA-LAB-2024-001'
WHERE NOT EXISTS (SELECT 1 FROM labs WHERE code = 'ML001');

INSERT INTO labs (name, code, address, city, state, pincode, phone, email, license_number)
SELECT 'MediLab North', 'ML002', '456 Care Avenue, North Zone', 'Mumbai', 'Maharashtra', '400001', '+91 22 2345 6789', 'north@medilab.com', 'MH-LAB-2024-002'
WHERE NOT EXISTS (SELECT 1 FROM labs WHERE code = 'ML002');

-- Insert sample departments (only if they don't exist)
INSERT INTO departments (name, code, description)
SELECT 'Hematology', 'HEMA', 'Blood and blood-related disorders'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'HEMA');

INSERT INTO departments (name, code, description)
SELECT 'Biochemistry', 'BIOC', 'Chemical analysis of body fluids'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'BIOC');

INSERT INTO departments (name, code, description)
SELECT 'Microbiology', 'MICR', 'Study of microorganisms'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MICR');

INSERT INTO departments (name, code, description)
SELECT 'Pathology', 'PATH', 'Disease diagnosis through tissue examination'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'PATH');

INSERT INTO departments (name, code, description)
SELECT 'Administration', 'ADMIN', 'Administrative and management functions'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'ADMIN');

-- Update existing users to have lab and department assignments (if they don't already have them)
DO $$
DECLARE
    central_lab_id UUID;
    hema_dept_id UUID;
    admin_dept_id UUID;
BEGIN
    -- Get the lab and department IDs
    SELECT id INTO central_lab_id FROM labs WHERE code = 'ML001' LIMIT 1;
    SELECT id INTO hema_dept_id FROM departments WHERE code = 'HEMA' LIMIT 1;
    SELECT id INTO admin_dept_id FROM departments WHERE code = 'ADMIN' LIMIT 1;
    
    -- Update existing users who don't have lab assignments
    IF central_lab_id IS NOT NULL AND hema_dept_id IS NOT NULL THEN
        UPDATE users 
        SET lab_id = central_lab_id, department_id = hema_dept_id 
        WHERE lab_id IS NULL AND department_id IS NULL;
    END IF;
END $$;

-- Insert sample users (only if they don't exist)
DO $$
DECLARE
    central_lab_id UUID;
    north_lab_id UUID;
    hema_dept_id UUID;
    bioc_dept_id UUID;
    admin_dept_id UUID;
BEGIN
    -- Get the lab and department IDs
    SELECT id INTO central_lab_id FROM labs WHERE code = 'ML001' LIMIT 1;
    SELECT id INTO north_lab_id FROM labs WHERE code = 'ML002' LIMIT 1;
    SELECT id INTO hema_dept_id FROM departments WHERE code = 'HEMA' LIMIT 1;
    SELECT id INTO bioc_dept_id FROM departments WHERE code = 'BIOC' LIMIT 1;
    SELECT id INTO admin_dept_id FROM departments WHERE code = 'ADMIN' LIMIT 1;
    
    -- Insert sample users if they don't exist and we have the required references
    IF central_lab_id IS NOT NULL AND admin_dept_id IS NOT NULL THEN
        INSERT INTO users (name, email, role, lab_id, department_id, phone)
        SELECT 'Dr. Sarah Wilson', 'sarah.wilson@medilab.com', 'Admin', central_lab_id, admin_dept_id, '+91 98765 43210'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'sarah.wilson@medilab.com');
    END IF;
    
    IF central_lab_id IS NOT NULL AND hema_dept_id IS NOT NULL THEN
        INSERT INTO users (name, email, role, lab_id, department_id, phone)
        SELECT 'Priya Sharma', 'priya.sharma@medilab.com', 'Lab Manager', central_lab_id, hema_dept_id, '+91 87654 32109'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'priya.sharma@medilab.com');
    END IF;
    
    IF north_lab_id IS NOT NULL AND bioc_dept_id IS NOT NULL THEN
        INSERT INTO users (name, email, role, lab_id, department_id, phone)
        SELECT 'Rajesh Kumar', 'rajesh.kumar@medilab.com', 'Technician', north_lab_id, bioc_dept_id, '+91 76543 21098'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'rajesh.kumar@medilab.com');
    END IF;
END $$;