-- =============================================
-- ADD USER ROLES TO ENUM TYPE
-- Migration: 20251127_add_user_roles_enum.sql
-- =============================================

-- First, let's check existing enum values and add missing ones
-- PostgreSQL requires adding enum values one at a time

-- Add 'Lab Manager' if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Lab Manager' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Lab Manager';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'Manager' if not exists  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Manager' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manager';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'Technician' if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Technician' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Technician';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'Receptionist' if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Receptionist' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Receptionist';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'Doctor' if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Doctor' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Doctor';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'Admin' if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Admin' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Admin';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Verify the enum values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype ORDER BY enumsortorder;
