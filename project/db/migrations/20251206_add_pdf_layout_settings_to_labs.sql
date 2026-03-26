-- Add pdf_layout_settings column to labs table for lab-level PDF configuration
-- This allows each lab to customize PDF layout (margins, scale, header/footer heights)

ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS pdf_layout_settings JSONB DEFAULT '{
  "scale": 1.0,
  "margins": {
    "top": 180,
    "right": 20,
    "bottom": 150,
    "left": 20
  },
  "headerHeight": 90,
  "footerHeight": 80,
  "displayHeaderFooter": true,
  "mediaType": "screen",
  "printBackground": true,
  "paperSize": "A4",
  "orientation": "portrait"
}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN labs.pdf_layout_settings IS 'Lab-level PDF layout settings (margins, scale, headerHeight, footerHeight, displayHeaderFooter, mediaType, printBackground, paperSize, orientation)';

-- Update existing labs to have the default settings
UPDATE labs 
SET pdf_layout_settings = '{
  "scale": 1.0,
  "margins": {
    "top": 180,
    "right": 20,
    "bottom": 150,
    "left": 20
  },
  "headerHeight": 90,
  "footerHeight": 80,
  "displayHeaderFooter": true,
  "mediaType": "screen",
  "printBackground": true,
  "paperSize": "A4",
  "orientation": "portrait"
}'::jsonb
WHERE pdf_layout_settings IS NULL;
