-- Comprehensive User Management System for LIMS v2
-- Creates roles, permissions, user management with Supabase auth integration

-- 1. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) UNIQUE NOT NULL,
    role_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- Admin, Manager, etc. are system roles
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert standard roles
INSERT INTO user_roles (role_name, role_code, description, is_system_role) VALUES
('Administrator', 'admin', 'Full system access and configuration', true),
('Lab Manager', 'lab_manager', 'Manage lab operations, staff, and workflows', true),
('Doctor', 'doctor', 'Review and approve results, generate reports', true),
('Technician', 'technician', 'Enter test results and process samples', true),
('Phlebotomist', 'phlebotomist', 'Collect samples and manage sample logistics', true),
('Receptionist', 'receptionist', 'Register patients, create orders, handle billing', true),
('Finance Manager', 'finance_manager', 'Manage billing, payments, and financial reports', true),
('Quality Control', 'quality_control', 'Monitor quality and compliance', true)
ON CONFLICT (role_code) DO NOTHING;

-- 2. Permissions Table (Granular permission system)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    permission_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50), -- Patient Management, Test Management, Finance, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert standard permissions
INSERT INTO permissions (permission_name, permission_code, description, category) VALUES
-- Patient Management
('View Patients', 'view_patients', 'View patient records and information', 'Patient Management'),
('Add Patient', 'add_patient', 'Register new patients', 'Patient Management'),
('Edit Patient', 'edit_patient', 'Modify patient information', 'Patient Management'),
('Delete Patient', 'delete_patient', 'Remove patient records', 'Patient Management'),

-- Order Management
('View Orders', 'view_orders', 'View test orders', 'Order Management'),
('Create Order', 'create_order', 'Create new test orders', 'Order Management'),
('Edit Order', 'edit_order', 'Modify existing orders', 'Order Management'),
('Cancel Order', 'cancel_order', 'Cancel test orders', 'Order Management'),
('Collect Sample', 'collect_sample', 'Mark samples as collected', 'Order Management'),

-- Test & Results
('Enter Results', 'enter_results', 'Enter test results and values', 'Test & Results'),
('View Results', 'view_results', 'View test results', 'Test & Results'),
('Edit Results', 'edit_results', 'Modify test results', 'Test & Results'),
('Approve Results', 'approve_results', 'Verify and approve results', 'Test & Results'),
('Unapprove Results', 'unapprove_results', 'Revert approved results', 'Test & Results'),

-- Reports
('Generate Reports', 'generate_reports', 'Generate patient reports', 'Reports'),
('Download Reports', 'download_reports', 'Download and print reports', 'Reports'),
('Edit Report Templates', 'edit_report_templates', 'Modify report templates', 'Reports'),
('View Report History', 'view_report_history', 'Access report generation history', 'Reports'),

-- Finance & Billing
('View Bills', 'view_bills', 'View billing information', 'Finance & Billing'),
('Create Invoice', 'create_invoice', 'Generate invoices', 'Finance & Billing'),
('Edit Invoice', 'edit_invoice', 'Modify invoices', 'Finance & Billing'),
('Process Payment', 'process_payment', 'Accept and record payments', 'Finance & Billing'),
('View Payment History', 'view_payment_history', 'Access payment records', 'Finance & Billing'),
('Manage Discounts', 'manage_discounts', 'Apply discounts and adjustments', 'Finance & Billing'),
('Manage Credit', 'manage_credit', 'Handle credit transactions', 'Finance & Billing'),

-- Lab Configuration
('Manage Tests', 'manage_tests', 'Add/edit/delete test groups', 'Lab Configuration'),
('Manage Analytes', 'manage_analytes', 'Configure analytes and parameters', 'Lab Configuration'),
('Manage Packages', 'manage_packages', 'Create test packages', 'Lab Configuration'),
('Lab Settings', 'lab_settings', 'Configure lab-wide settings', 'Lab Configuration'),
('Manage Branding', 'manage_branding', 'Configure lab branding and templates', 'Lab Configuration'),

-- User Management
('View Users', 'view_users', 'View user accounts', 'User Management'),
('Add User', 'add_user', 'Create new user accounts', 'User Management'),
('Edit User', 'edit_user', 'Modify user information', 'User Management'),
('Delete User', 'delete_user', 'Remove user accounts', 'User Management'),
('Manage Roles', 'manage_roles', 'Configure user roles and permissions', 'User Management'),

-- WhatsApp Integration
('Manual WhatsApp', 'manual_whatsapp', 'Send manual WhatsApp messages', 'WhatsApp Integration'),
('WhatsApp Settings', 'whatsapp_settings', 'Configure WhatsApp integration', 'WhatsApp Integration'),

-- Master Data
('Manage Doctors', 'manage_doctors', 'Add/edit doctor information', 'Master Data'),
('Manage Locations', 'manage_locations', 'Configure collection centers', 'Master Data'),
('Manage Accounts', 'manage_accounts', 'Manage B2B accounts', 'Master Data')

ON CONFLICT (permission_code) DO NOTHING;

-- 3. Role-Permission Mapping (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- Assign permissions to Admin role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'admin'),
    id
FROM permissions
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Assign permissions to Lab Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'lab_manager'),
    id
FROM permissions
WHERE permission_code IN (
    'view_patients', 'add_patient', 'edit_patient',
    'view_orders', 'create_order', 'edit_order', 'collect_sample',
    'enter_results', 'view_results', 'edit_results',
    'generate_reports', 'download_reports',
    'view_bills', 'create_invoice', 'view_payment_history',
    'manage_tests', 'manage_analytes', 'manage_packages',
    'view_users', 'edit_user'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to Doctor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'doctor'),
    id
FROM permissions
WHERE permission_code IN (
    'view_patients', 'view_orders', 'view_results',
    'approve_results', 'unapprove_results',
    'generate_reports', 'download_reports', 'view_report_history'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to Technician role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'technician'),
    id
FROM permissions
WHERE permission_code IN (
    'view_patients', 'view_orders', 'collect_sample',
    'enter_results', 'view_results', 'edit_results',
    'view_report_history'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to Phlebotomist role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'phlebotomist'),
    id
FROM permissions
WHERE permission_code IN (
    'view_patients', 'view_orders', 'collect_sample'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to Receptionist role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'receptionist'),
    id
FROM permissions
WHERE permission_code IN (
    'view_patients', 'add_patient', 'edit_patient',
    'view_orders', 'create_order', 'edit_order',
    'view_results',
    'generate_reports', 'download_reports',
    'view_bills', 'create_invoice', 'process_payment', 'view_payment_history'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to Finance Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM user_roles WHERE role_code = 'finance_manager'),
    id
FROM permissions
WHERE permission_code IN (
    'view_bills', 'create_invoice', 'edit_invoice',
    'process_payment', 'view_payment_history',
    'manage_discounts', 'manage_credit',
    'manage_accounts', 'manage_locations'
)
ON CONFLICT DO NOTHING;

-- 4. User-Centers Mapping (For multi-center access control)
CREATE TABLE IF NOT EXISTS user_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, location_id)
);

-- 5. Enhance users table with role relationship
DO $$ 
BEGIN
    -- Add role_id column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'role_id') THEN
        ALTER TABLE users ADD COLUMN role_id UUID REFERENCES user_roles(id);
    END IF;

    -- Add username column for login (optional - can use email)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(100) UNIQUE;
    END IF;

    -- Add contact number as VARCHAR if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'contact_number') THEN
        ALTER TABLE users ADD COLUMN contact_number VARCHAR(20);
    ELSE
        -- If exists, make sure it's VARCHAR (might have been created as other type)
        ALTER TABLE users ALTER COLUMN contact_number TYPE VARCHAR(20);
    END IF;

    -- Add gender column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'gender') THEN
        ALTER TABLE users ADD COLUMN gender VARCHAR(20);
    END IF;

    -- Add auth_user_id to link to Supabase auth.users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'auth_user_id') THEN
        ALTER TABLE users ADD COLUMN auth_user_id UUID UNIQUE;
    END IF;
END $$;

-- 6. Create RPC function to create user with Supabase auth
CREATE OR REPLACE FUNCTION create_user_with_auth(
    p_email VARCHAR,
    p_password VARCHAR,
    p_name VARCHAR,
    p_role_id UUID,
    p_lab_id UUID,
    p_department_id UUID DEFAULT NULL,
    p_contact_number VARCHAR DEFAULT NULL,
    p_gender VARCHAR DEFAULT NULL,
    p_location_ids UUID[] DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_auth_user_id UUID;
    v_result JSONB;
    v_location_id UUID;
BEGIN
    -- Note: Supabase auth.users creation must be done via admin API in application layer
    -- This function only creates the public.users record
    
    -- Generate UUID for new user
    v_user_id := gen_random_uuid();
    
    -- Insert into public.users table
    INSERT INTO users (
        id,
        name,
        email,
        role_id,
        lab_id,
        department_id,
        contact_number,
        gender,
        status,
        join_date,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        p_name,
        p_email,
        p_role_id,
        p_lab_id,
        p_department_id,
        p_contact_number,
        p_gender,
        'Active',
        CURRENT_DATE,
        now(),
        now()
    );
    
    -- If location_ids provided, create user-center mappings
    IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
        FOREACH v_location_id IN ARRAY p_location_ids LOOP
            INSERT INTO user_centers (user_id, location_id, is_primary)
            VALUES (v_user_id, v_location_id, v_location_id = p_location_ids[1]);
        END LOOP;
    END IF;
    
    -- Return success result
    v_result := jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'message', 'User created successfully. Auth user must be created separately via Supabase Admin API.'
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create view for user with role and permissions
CREATE OR REPLACE VIEW v_users_with_permissions AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.username,
    u.contact_number,
    u.gender,
    u.status,
    u.join_date,
    u.last_login,
    u.lab_id,
    u.department_id,
    u.auth_user_id,
    u.is_phlebotomist,
    ur.id as role_id,
    ur.role_name,
    ur.role_code,
    array_agg(DISTINCT p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL) as permissions,
    array_agg(DISTINCT uc.location_id) FILTER (WHERE uc.location_id IS NOT NULL) as assigned_centers
FROM users u
LEFT JOIN user_roles ur ON u.role_id = ur.id
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
LEFT JOIN user_centers uc ON u.id = uc.user_id
WHERE u.status = 'Active'
GROUP BY u.id, u.name, u.email, u.username, u.contact_number, u.gender, 
         u.status, u.join_date, u.last_login, u.lab_id, u.department_id, 
         u.auth_user_id, u.is_phlebotomist, ur.id, ur.role_name, ur.role_code;

-- 8. RPC function to check user permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_permission_code VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        JOIN role_permissions rp ON ur.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = p_user_id
          AND p.permission_code = p_permission_code
          AND u.status = 'Active'
          AND ur.is_active = true
          AND p.is_active = true
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update existing users to have role_id (migrate from legacy role column)
DO $$
BEGIN
    -- Map existing role string to role_id
    UPDATE users u
    SET role_id = (
        CASE 
            WHEN u.role = 'Admin' THEN (SELECT id FROM user_roles WHERE role_code = 'admin')
            WHEN u.role = 'Lab Manager' THEN (SELECT id FROM user_roles WHERE role_code = 'lab_manager')
            WHEN u.role = 'Doctor' THEN (SELECT id FROM user_roles WHERE role_code = 'doctor')
            WHEN u.role = 'Technician' THEN (SELECT id FROM user_roles WHERE role_code = 'technician')
            WHEN u.role = 'Receptionist' THEN (SELECT id FROM user_roles WHERE role_code = 'receptionist')
            ELSE (SELECT id FROM user_roles WHERE role_code = 'technician') -- Default
        END
    )
    WHERE u.role_id IS NULL;
END $$;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_lab_id ON users(lab_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_centers_user_id ON user_centers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_centers_location_id ON user_centers(location_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- 11. Add RLS policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_centers ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read roles and permissions (for UI display)
CREATE POLICY "Authenticated users can read roles" ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read permissions" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read role permissions" ON role_permissions FOR SELECT TO authenticated USING (true);

-- Only admins can manage roles and permissions (requires permission check)
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        WHERE u.auth_user_id = auth.uid() AND ur.role_code = 'admin'
    )
);

-- Users can see their own center assignments
CREATE POLICY "Users can view their centers" ON user_centers FOR SELECT TO authenticated 
USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Admins can manage center assignments
CREATE POLICY "Admins can manage user centers" ON user_centers FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        WHERE u.auth_user_id = auth.uid() AND ur.role_code = 'admin'
    )
);

COMMENT ON TABLE user_roles IS 'Defines user roles in the system (Admin, Manager, Doctor, etc.)';
COMMENT ON TABLE permissions IS 'Granular permissions for access control';
COMMENT ON TABLE role_permissions IS 'Maps permissions to roles (many-to-many)';
COMMENT ON TABLE user_centers IS 'Maps users to collection centers for multi-center access control';
COMMENT ON FUNCTION create_user_with_auth IS 'Creates user in public.users table (auth.users creation handled separately via Admin API)';
COMMENT ON FUNCTION user_has_permission IS 'Checks if a user has a specific permission';
COMMENT ON VIEW v_users_with_permissions IS 'User details with role and aggregated permissions';
