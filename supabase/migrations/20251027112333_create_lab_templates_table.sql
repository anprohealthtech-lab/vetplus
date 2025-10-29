-- Create lab_templates table for storing GrapesJS templates per lab
DO $$ 
BEGIN
    -- Create lab_templates table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_templates') THEN
        CREATE TABLE lab_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
            template_name VARCHAR(255) NOT NULL,
            template_description TEXT,
            test_group_id UUID REFERENCES test_groups(id) ON DELETE SET NULL,
            category VARCHAR(100) DEFAULT 'general',
            
            -- GrapesJS project data
            gjs_html TEXT, -- Final rendered HTML
            gjs_css TEXT,  -- Final rendered CSS
            gjs_components JSONB, -- GrapesJS components structure
            gjs_styles JSONB,     -- GrapesJS styles data
            gjs_project JSONB,    -- Complete GrapesJS project JSON
            
            -- Template metadata
            is_active BOOLEAN DEFAULT true,
            is_default BOOLEAN DEFAULT false,
            template_version INTEGER DEFAULT 1,
            
            -- Audit fields
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            
            -- Constraints
            CONSTRAINT unique_lab_template_name UNIQUE(lab_id, template_name),
            CONSTRAINT unique_default_per_category EXCLUDE (lab_id WITH =, category WITH =) WHERE (is_default = true)
        );

        -- Add indexes for performance
        CREATE INDEX idx_lab_templates_lab_id ON lab_templates(lab_id);
        CREATE INDEX idx_lab_templates_test_group ON lab_templates(test_group_id);
        CREATE INDEX idx_lab_templates_category ON lab_templates(category);
        CREATE INDEX idx_lab_templates_active ON lab_templates(is_active) WHERE is_active = true;

        -- Add RLS (Row Level Security)
        ALTER TABLE lab_templates ENABLE ROW LEVEL SECURITY;

        -- RLS Policy: Users can only see templates from their own lab
        CREATE POLICY "Users can view lab templates from their lab" ON lab_templates
            FOR SELECT USING (
                lab_id IN (
                    SELECT users.lab_id 
                    FROM users 
                    WHERE users.id = auth.uid()
                )
            );

        -- RLS Policy: Users can insert templates for their lab
        CREATE POLICY "Users can create templates for their lab" ON lab_templates
            FOR INSERT WITH CHECK (
                lab_id IN (
                    SELECT users.lab_id 
                    FROM users 
                    WHERE users.id = auth.uid()
                )
            );

        -- RLS Policy: Users can update templates from their lab
        CREATE POLICY "Users can update templates from their lab" ON lab_templates
            FOR UPDATE USING (
                lab_id IN (
                    SELECT users.lab_id 
                    FROM users 
                    WHERE users.id = auth.uid()
                )
            );

        -- RLS Policy: Users can delete templates from their lab
        CREATE POLICY "Users can delete templates from their lab" ON lab_templates
            FOR DELETE USING (
                lab_id IN (
                    SELECT users.lab_id 
                    FROM users 
                    WHERE users.id = auth.uid()
                )
            );

        -- Update trigger for updated_at
        CREATE OR REPLACE FUNCTION update_lab_templates_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_lab_templates_updated_at
            BEFORE UPDATE ON lab_templates
            FOR EACH ROW
            EXECUTE FUNCTION update_lab_templates_updated_at();

        RAISE NOTICE 'Created lab_templates table with RLS policies and indexes';
    ELSE
        RAISE NOTICE 'lab_templates table already exists, skipping creation';
    END IF;

    -- Create lab_template_versions table for version history if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_template_versions') THEN
        CREATE TABLE lab_template_versions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            template_id UUID NOT NULL REFERENCES lab_templates(id) ON DELETE CASCADE,
            version_number INTEGER NOT NULL,
            
            -- Versioned GrapesJS data
            gjs_html TEXT,
            gjs_css TEXT,
            gjs_components JSONB,
            gjs_styles JSONB,
            gjs_project JSONB,
            
            -- Version metadata
            version_name VARCHAR(255),
            version_notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            created_by UUID REFERENCES users(id),
            
            CONSTRAINT unique_template_version UNIQUE(template_id, version_number)
        );

        -- Add indexes
        CREATE INDEX idx_lab_template_versions_template_id ON lab_template_versions(template_id);
        CREATE INDEX idx_lab_template_versions_version ON lab_template_versions(template_id, version_number);

        -- Add RLS
        ALTER TABLE lab_template_versions ENABLE ROW LEVEL SECURITY;

        -- RLS Policy: Users can only see versions of templates from their lab
        CREATE POLICY "Users can view template versions from their lab" ON lab_template_versions
            FOR SELECT USING (
                template_id IN (
                    SELECT lt.id 
                    FROM lab_templates lt
                    JOIN users u ON u.lab_id = lt.lab_id
                    WHERE u.id = auth.uid()
                )
            );

        -- RLS Policy: Users can create versions for templates from their lab
        CREATE POLICY "Users can create template versions for their lab" ON lab_template_versions
            FOR INSERT WITH CHECK (
                template_id IN (
                    SELECT lt.id 
                    FROM lab_templates lt
                    JOIN users u ON u.lab_id = lt.lab_id
                    WHERE u.id = auth.uid()
                )
            );

        RAISE NOTICE 'Created lab_template_versions table with RLS policies';
    ELSE
        RAISE NOTICE 'lab_template_versions table already exists, skipping creation';
    END IF;
END $$;
