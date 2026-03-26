/*
  # Add patient identification fields
  
  1. New Fields
    - `qr_code_data` (text): Stores the raw data encoded in the QR code
    - `color_code` (text): Stores the HEX value of the assigned color
    - `color_name` (text): Stores the human-readable name of the assigned color
  
  2. Purpose
    - These fields enable a color + QR code-based patient identification system
    - Enhances sample tracking and future AI-based validation
*/

ALTER TABLE patients
ADD COLUMN qr_code_data text,
ADD COLUMN color_code text,
ADD COLUMN color_name text;