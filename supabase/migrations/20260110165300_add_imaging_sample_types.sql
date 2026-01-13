-- Migration: Add imaging/radiology modalities to sample_type enum
-- Description: Adds common radiology and imaging modalities as valid sample types

-- Add new sample type values for imaging/radiology
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'X-Ray';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'CT Scan';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'MRI';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Ultrasound';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Mammography';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'PET Scan';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Fluoroscopy';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Angiography';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'DEXA Scan';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'ECG';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'EEG';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Endoscopy';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Colonoscopy';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'Bronchoscopy';
ALTER TYPE sample_type ADD VALUE IF NOT EXISTS 'No Sample Required';

-- Add comment
COMMENT ON TYPE sample_type IS 'Sample types including laboratory specimens and imaging/diagnostic modalities';
