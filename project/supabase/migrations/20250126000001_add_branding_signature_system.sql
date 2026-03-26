-- Branding & Signature Rollout - Phase 1: Storage & Schema
-- This migration adds lab branding assets and user signature management

BEGIN;

-- 1. Create lab_branding_assets table
CREATE TABLE IF NOT EXISTS lab_branding_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('header', 'footer', 'watermark', 'logo', 'letterhead')),
    asset_name VARCHAR(200) NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- image/png, image/jpeg, etc.
    file_size BIGINT,
    dimensions JSONB, -- { "width": 800, "height": 200 }
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Only one default per asset_type per lab
    description TEXT,
    usage_context TEXT[], -- ['reports', 'invoices', 'certificates']
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one default per asset type per lab
    CONSTRAINT unique_default_asset_per_lab UNIQUE (lab_id, asset_type, is_default) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Create lab_user_signatures table
CREATE TABLE IF NOT EXISTS lab_user_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN ('digital', 'handwritten', 'stamp', 'text')),
    signature_name VARCHAR(200) NOT NULL,
    file_url TEXT, -- NULL for text signatures
    file_path TEXT, -- NULL for text signatures
    file_type VARCHAR(50), -- image/png for digital signatures
    file_size BIGINT,
    dimensions JSONB, -- { "width": 300, "height": 100 }
    text_signature TEXT, -- For text-based signatures
    signature_data JSONB, -- For storing signature metadata, fonts, etc.
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Only one default per user per lab
    description TEXT,
    usage_context TEXT[], -- ['reports', 'prescriptions', 'certificates']
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure user belongs to the lab
    CONSTRAINT fk_user_signature_lab_user CHECK (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = user_id AND u.lab_id = lab_id
        )
    ),
    
    -- Ensure only one default signature per user per lab
    CONSTRAINT unique_default_signature_per_user_lab UNIQUE (lab_id, user_id, is_default) DEFERRABLE INITIALLY DEFERRED,
    
    -- Ensure user can only have signatures in their own lab
    CONSTRAINT unique_user_signature_per_lab UNIQUE (lab_id, user_id, signature_type, signature_name)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lab_branding_assets_lab_id ON lab_branding_assets(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_branding_assets_active ON lab_branding_assets(lab_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lab_branding_assets_default ON lab_branding_assets(lab_id, asset_type, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_lab_user_signatures_user_lab ON lab_user_signatures(user_id, lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_user_signatures_active ON lab_user_signatures(user_id, lab_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lab_user_signatures_default ON lab_user_signatures(user_id, lab_id, is_default) WHERE is_default = true;

-- 4. Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_branding_assets_updated_at
    BEFORE UPDATE ON lab_branding_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lab_user_signatures_updated_at
    BEFORE UPDATE ON lab_user_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Create helper functions

-- Function to get lab branding assets by type
CREATE OR REPLACE FUNCTION get_lab_branding_assets(
    p_lab_id UUID,
    p_asset_type VARCHAR DEFAULT NULL,
    p_active_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    asset_type VARCHAR,
    asset_name VARCHAR,
    file_url TEXT,
    file_path TEXT,
    file_type VARCHAR,
    file_size BIGINT,
    dimensions JSONB,
    is_active BOOLEAN,
    is_default BOOLEAN,
    description TEXT,
    usage_context TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.asset_type::VARCHAR,
        a.asset_name::VARCHAR,
        a.file_url,
        a.file_path,
        a.file_type::VARCHAR,
        a.file_size,
        a.dimensions,
        a.is_active,
        a.is_default,
        a.description,
        a.usage_context,
        a.created_at
    FROM lab_branding_assets a
    WHERE a.lab_id = p_lab_id
        AND (p_asset_type IS NULL OR a.asset_type = p_asset_type)
        AND (NOT p_active_only OR a.is_active = true)
    ORDER BY a.is_default DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user signatures
CREATE OR REPLACE FUNCTION get_user_signatures(
    p_user_id UUID,
    p_lab_id UUID,
    p_active_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    signature_type VARCHAR,
    signature_name VARCHAR,
    file_url TEXT,
    file_path TEXT,
    file_type VARCHAR,
    file_size BIGINT,
    dimensions JSONB,
    text_signature TEXT,
    signature_data JSONB,
    is_active BOOLEAN,
    is_default BOOLEAN,
    description TEXT,
    usage_context TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.signature_type::VARCHAR,
        s.signature_name::VARCHAR,
        s.file_url,
        s.file_path,
        s.file_type::VARCHAR,
        s.file_size,
        s.dimensions,
        s.text_signature,
        s.signature_data,
        s.is_active,
        s.is_default,
        s.description,
        s.usage_context,
        s.created_at
    FROM lab_user_signatures s
    WHERE s.user_id = p_user_id
        AND s.lab_id = p_lab_id
        AND (NOT p_active_only OR s.is_active = true)
    ORDER BY s.is_default DESC, s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set default branding asset (ensures only one default per type per lab)
CREATE OR REPLACE FUNCTION set_default_branding_asset(
    p_asset_id UUID,
    p_lab_id UUID,
    p_asset_type VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    -- First, unset all defaults for this asset type and lab
    UPDATE lab_branding_assets
    SET is_default = false, updated_at = NOW()
    WHERE lab_id = p_lab_id AND asset_type = p_asset_type;
    
    -- Then set the specified asset as default
    UPDATE lab_branding_assets
    SET is_default = true, updated_at = NOW()
    WHERE id = p_asset_id AND lab_id = p_lab_id AND asset_type = p_asset_type;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set default user signature (ensures only one default per user per lab)
CREATE OR REPLACE FUNCTION set_default_user_signature(
    p_signature_id UUID,
    p_user_id UUID,
    p_lab_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- First, unset all defaults for this user and lab
    UPDATE lab_user_signatures
    SET is_default = false, updated_at = NOW()
    WHERE user_id = p_user_id AND lab_id = p_lab_id;
    
    -- Then set the specified signature as default
    UPDATE lab_user_signatures
    SET is_default = true, updated_at = NOW()
    WHERE id = p_signature_id AND user_id = p_user_id AND lab_id = p_lab_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE lab_branding_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_user_signatures ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies

-- Lab branding assets - Users can only see/manage assets for their lab
CREATE POLICY "Users can view lab branding assets"
    ON lab_branding_assets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_branding_assets.lab_id
        )
    );

CREATE POLICY "Users can manage lab branding assets"
    ON lab_branding_assets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_branding_assets.lab_id
            AND u.role IN ('Admin', 'Manager', 'Lab Manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_branding_assets.lab_id
            AND u.role IN ('Admin', 'Manager', 'Lab Manager')
        )
    );

-- User signatures - Users can manage their own signatures, admins can manage all
CREATE POLICY "Users can view signatures in their lab"
    ON lab_user_signatures FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_user_signatures.lab_id
        )
    );

CREATE POLICY "Users can manage their own signatures"
    ON lab_user_signatures FOR ALL
    USING (
        user_id = auth.uid()::uuid
        AND EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_user_signatures.lab_id
        )
    )
    WITH CHECK (
        user_id = auth.uid()::uuid
        AND EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_user_signatures.lab_id
        )
    );

CREATE POLICY "Admins can manage all signatures in their lab"
    ON lab_user_signatures FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_user_signatures.lab_id
            AND u.role IN ('Admin', 'Manager', 'Lab Manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid()::uuid 
            AND u.lab_id = lab_user_signatures.lab_id
            AND u.role IN ('Admin', 'Manager', 'Lab Manager')
        )
    );

-- 8. Grant permissions
GRANT SELECT ON lab_branding_assets TO authenticated;
GRANT SELECT ON lab_user_signatures TO authenticated;
GRANT ALL ON lab_branding_assets TO authenticated;
GRANT ALL ON lab_user_signatures TO authenticated;

GRANT EXECUTE ON FUNCTION get_lab_branding_assets TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_signatures TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_branding_asset TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_user_signature TO authenticated;

-- 9. Insert some example branding asset types (optional)
INSERT INTO lab_branding_assets (lab_id, asset_type, asset_name, file_url, file_path, file_type, is_active, is_default, description, usage_context, created_by)
SELECT 
    l.id,
    'header',
    l.name || ' - Default Header',
    'https://placeholder-url.com/header.png',
    'attachments/labs/' || l.id || '/branding/header/default-header.png',
    'image/png',
    false, -- Set to false initially, admin can activate
    true,
    'Default header template for ' || l.name,
    ARRAY['reports', 'invoices'],
    NULL
FROM labs l
WHERE l.is_active = true
ON CONFLICT DO NOTHING;

COMMIT;