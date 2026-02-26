-- Add lab-level flag options (customizable per lab)
ALTER TABLE labs ADD COLUMN IF NOT EXISTS flag_options JSONB DEFAULT '[
  {"value":"","label":"Normal"},
  {"value":"H","label":"High"},
  {"value":"L","label":"Low"},
  {"value":"A","label":"Abnormal"},
  {"value":"C","label":"Critical"}
]'::jsonb;

COMMENT ON COLUMN labs.flag_options IS 'Lab-customizable flag options shown in result entry, verification, and analyte flag mapping. Array of {value, label} objects.';

-- Add expected_value_flag_map to analytes (global level)
ALTER TABLE analytes ADD COLUMN IF NOT EXISTS expected_value_flag_map JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN analytes.expected_value_flag_map IS 'Maps each dropdown option to a flag value. E.g. {"Non-Reactive":"","Reactive":"A"}';

-- Add expected_value_flag_map to lab_analytes (lab-level override)
ALTER TABLE lab_analytes ADD COLUMN IF NOT EXISTS expected_value_flag_map JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN lab_analytes.expected_value_flag_map IS 'Lab-specific override for dropdown-to-flag mapping. E.g. {"Non-Reactive":"","Reactive":"A"}';
