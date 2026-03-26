-- AI Protocols System Schema
-- Protocol-based AI workflow management for LIMS integration

-- AI Protocol Definitions
CREATE TABLE ai_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'document', 'image', 'validation', 'analysis'
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    
    -- Protocol Configuration
    config JSONB NOT NULL DEFAULT '{}', -- Step definitions, timing, validation rules
    
    -- Integration Settings
    requires_lims_integration BOOLEAN DEFAULT false,
    target_table VARCHAR(100), -- Which LIMS table to update (orders, patients, tests)
    result_mapping JSONB DEFAULT '{}', -- How to map AI results to LIMS fields
    
    -- UI Configuration
    ui_config JSONB DEFAULT '{}', -- Button placement, colors, labels
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- AI Protocol Steps (ordered workflow steps)
CREATE TABLE ai_protocol_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID REFERENCES ai_protocols(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL, -- 'capture', 'timer', 'instruction', 'analysis', 'validation'
    
    -- Step Configuration
    title VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}', -- Step-specific settings
    
    -- Validation Rules
    is_required BOOLEAN DEFAULT true,
    validation_rules JSONB DEFAULT '{}',
    
    -- Timing
    estimated_duration_seconds INTEGER,
    max_duration_seconds INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(protocol_id, step_order)
);

-- AI Protocol Sessions (execution instances)
CREATE TABLE ai_protocol_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID REFERENCES ai_protocols(id),
    
    -- Context Linking
    order_id UUID REFERENCES orders(id), -- Optional LIMS linking
    patient_id UUID REFERENCES patients(id), -- Optional patient linking
    test_id UUID, -- Optional test linking
    
    -- Session State
    status VARCHAR(50) DEFAULT 'started', -- 'started', 'in_progress', 'completed', 'failed', 'cancelled'
    current_step_id UUID REFERENCES ai_protocol_steps(id),
    current_step_order INTEGER DEFAULT 1,
    
    -- Session Data
    session_data JSONB DEFAULT '{}', -- Accumulated data from all steps
    results JSONB DEFAULT '{}', -- Final analysis results
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- User Context
    user_id UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Capture Data (files, images, documents per session)
CREATE TABLE ai_captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ai_protocol_sessions(id) ON DELETE CASCADE,
    step_id UUID REFERENCES ai_protocol_steps(id),
    
    -- Capture Details
    capture_type VARCHAR(50) NOT NULL, -- 'image', 'document', 'video', 'audio'
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Capture Metadata
    capture_metadata JSONB DEFAULT '{}', -- Camera settings, OCR confidence, etc.
    
    -- AI Analysis Results
    analysis_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    analysis_results JSONB DEFAULT '{}',
    confidence_score DECIMAL(3,2),
    
    -- Processing
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_duration_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_protocols_category ON ai_protocols(category);
CREATE INDEX idx_ai_protocols_active ON ai_protocols(is_active);
CREATE INDEX idx_ai_protocol_steps_protocol ON ai_protocol_steps(protocol_id, step_order);
CREATE INDEX idx_ai_sessions_status ON ai_protocol_sessions(status);
CREATE INDEX idx_ai_sessions_user ON ai_protocol_sessions(user_id);
CREATE INDEX idx_ai_sessions_order ON ai_protocol_sessions(order_id);
CREATE INDEX idx_ai_captures_session ON ai_captures(session_id);
CREATE INDEX idx_ai_captures_analysis ON ai_captures(analysis_status);

-- RLS Policies
ALTER TABLE ai_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_protocol_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_protocol_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_captures ENABLE ROW LEVEL SECURITY;

-- Protocols are readable by all authenticated users
CREATE POLICY "Protocols readable by authenticated users" ON ai_protocols
    FOR SELECT TO authenticated USING (true);

-- Protocol steps follow parent protocol permissions
CREATE POLICY "Protocol steps readable by authenticated users" ON ai_protocol_steps
    FOR SELECT TO authenticated USING (true);

-- Users can manage their own sessions
CREATE POLICY "Users can manage own sessions" ON ai_protocol_sessions
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Users can manage captures for their sessions
CREATE POLICY "Users can manage own captures" ON ai_captures
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM ai_protocol_sessions 
            WHERE ai_protocol_sessions.id = ai_captures.session_id 
            AND ai_protocol_sessions.user_id = auth.uid()
        )
    );

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_protocols_updated_at 
    BEFORE UPDATE ON ai_protocols 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ai_protocols IS 'Protocol definitions for AI-powered workflows';
COMMENT ON TABLE ai_protocol_steps IS 'Ordered steps within each AI protocol';
COMMENT ON TABLE ai_protocol_sessions IS 'Execution instances of AI protocols';
COMMENT ON TABLE ai_captures IS 'Files and data captured during protocol execution';
