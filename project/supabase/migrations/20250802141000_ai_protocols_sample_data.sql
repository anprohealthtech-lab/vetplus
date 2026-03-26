-- Sample AI Protocols Data
-- Pre-configured protocols for common LIMS workflows

-- 1. Document OCR Protocol
INSERT INTO ai_protocols (
    name, description, category, config, requires_lims_integration, target_table, ui_config
) VALUES (
    'Document OCR Extraction',
    'Extract text and data from lab documents, reports, and forms using OCR technology',
    'document',
    '{
        "ai_service": "vision-ocr",
        "output_format": "structured_json",
        "confidence_threshold": 0.8,
        "post_processing": ["spell_check", "data_validation"],
        "expected_fields": ["patient_id", "test_results", "date", "technician"]
    }',
    true,
    'orders',
    '{
        "button_color": "blue",
        "button_text": "Extract Document",
        "icon": "document-text",
        "placement": "orders_detail"
    }'
);

-- 2. Photo Analysis Protocol
INSERT INTO ai_protocols (
    name, description, category, config, requires_lims_integration, target_table, ui_config
) VALUES (
    'Sample Photo Analysis',
    'Analyze sample photos for visual quality, color changes, and anomalies',
    'image',
    '{
        "ai_service": "gemini-nlp",
        "analysis_type": "visual_inspection",
        "detect_anomalies": true,
        "color_analysis": true,
        "quality_metrics": ["clarity", "lighting", "focus"],
        "comparison_mode": false
    }',
    true,
    'tests',
    '{
        "button_color": "green",
        "button_text": "Analyze Photo",
        "icon": "camera",
        "placement": "test_detail"
    }'
);

-- 3. Pipette Validation Protocol
INSERT INTO ai_protocols (
    name, description, category, config, requires_lims_integration, target_table, ui_config
) VALUES (
    'Pipette Accuracy Validation',
    'Validate pipette accuracy through timed dispensing and measurement analysis',
    'validation',
    '{
        "validation_type": "pipette_accuracy",
        "required_measurements": 10,
        "acceptable_variance": 0.02,
        "timer_intervals": [30, 60, 90],
        "auto_calculations": true
    }',
    false,
    null,
    '{
        "button_color": "purple",
        "button_text": "Validate Pipette",
        "icon": "beaker",
        "placement": "standalone"
    }'
);

-- Steps for Document OCR Protocol
INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds) 
SELECT 
    id, 1, 'instruction', 
    'Prepare Document', 
    'Ensure document is flat, well-lit, and all text is visible',
    '{"requirements": ["good_lighting", "flat_surface", "clear_text"]}',
    30
FROM ai_protocols WHERE name = 'Document OCR Extraction';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 2, 'capture', 
    'Capture Document Photo', 
    'Take a clear photo of the entire document',
    '{"capture_type": "image", "quality": "high", "auto_focus": true, "flash": "auto"}',
    60
FROM ai_protocols WHERE name = 'Document OCR Extraction';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 3, 'analysis', 
    'OCR Processing', 
    'AI extracts text and structured data from the document',
    '{"ai_service": "vision-ocr", "auto_proceed": true, "show_progress": true}',
    120
FROM ai_protocols WHERE name = 'Document OCR Extraction';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 4, 'validation', 
    'Review Results', 
    'Review extracted data and make corrections if needed',
    '{"allow_editing": true, "highlight_low_confidence": true, "require_approval": true}',
    180
FROM ai_protocols WHERE name = 'Document OCR Extraction';

-- Steps for Photo Analysis Protocol
INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 1, 'instruction', 
    'Setup Camera', 
    'Position sample in good lighting with clear background',
    '{"requirements": ["stable_surface", "uniform_lighting", "neutral_background"]}',
    45
FROM ai_protocols WHERE name = 'Sample Photo Analysis';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 2, 'capture', 
    'Take Sample Photo', 
    'Capture high-quality photo of the sample',
    '{"capture_type": "image", "quality": "high", "macro_mode": true, "grid_overlay": true}',
    30
FROM ai_protocols WHERE name = 'Sample Photo Analysis';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 3, 'analysis', 
    'AI Visual Analysis', 
    'AI analyzes photo for quality, color, and anomalies',
    '{"ai_service": "gemini-nlp", "analysis_depth": "detailed", "generate_report": true}',
    90
FROM ai_protocols WHERE name = 'Sample Photo Analysis';

-- Steps for Pipette Validation Protocol
INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 1, 'instruction', 
    'Prepare Equipment', 
    'Prepare pipette, tips, and measurement scale',
    '{"requirements": ["calibrated_scale", "clean_pipette", "fresh_tips"]}',
    60
FROM ai_protocols WHERE name = 'Pipette Accuracy Validation';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 2, 'timer', 
    'Timed Measurements', 
    'Perform 10 measurements with 30-second intervals',
    '{"timer_duration": 30, "repeat_count": 10, "auto_advance": false}',
    300
FROM ai_protocols WHERE name = 'Pipette Accuracy Validation';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 3, 'capture', 
    'Record Measurements', 
    'Enter each measurement value',
    '{"capture_type": "numerical", "unit": "µL", "decimal_places": 2, "validation": "range"}',
    180
FROM ai_protocols WHERE name = 'Pipette Accuracy Validation';

INSERT INTO ai_protocol_steps (protocol_id, step_order, step_type, title, description, config, estimated_duration_seconds)
SELECT 
    id, 4, 'analysis', 
    'Calculate Accuracy', 
    'AI calculates accuracy, precision, and compliance',
    '{"calculations": ["mean", "std_dev", "cv_percent"], "pass_fail": true, "generate_certificate": true}',
    60
FROM ai_protocols WHERE name = 'Pipette Accuracy Validation';

COMMENT ON TABLE ai_protocols IS 'Contains sample protocols: Document OCR, Photo Analysis, and Pipette Validation';
