-- Add default_template_style to labs table
-- Controls which fallback template to use when a test group has no custom HTML template
-- Values: 'beautiful' (3-band color matrix) or 'classic' (plain table)
ALTER TABLE labs ADD COLUMN IF NOT EXISTS default_template_style text DEFAULT 'beautiful';

COMMENT ON COLUMN labs.default_template_style IS 'Default report template style when no custom template exists: beautiful (3-band color matrix) or classic (plain table)';
