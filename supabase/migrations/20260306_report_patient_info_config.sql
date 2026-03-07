-- Add configurable patient info section for default report templates
-- Labs can choose layout (table/inline) and which fields to display

ALTER TABLE labs
  ADD COLUMN IF NOT EXISTS report_patient_info_config JSONB DEFAULT NULL;

COMMENT ON COLUMN labs.report_patient_info_config IS
  'Configures patient info section in default/classic/beautiful PDF templates. Schema: { layout: "table"|"inline", fields: ["patientName","patientId","age","gender","collectionDate","sampleId","referringDoctorName","approvedAt","sampleCollectedBy","phone"] }. NULL = use template defaults.';
