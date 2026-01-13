-- Update Urine Routine Examination (Urine R/M) configuration in global_test_catalog
-- Improves group-level prompt and AI config for comprehensive urinalysis

UPDATE global_test_catalog
SET 
  description = 'A comprehensive three-part urinalysis to assess physical, chemical, and microscopic properties of urine. Includes visual inspection, dipstick analysis, and microscopic sediment examination. Used to detect and manage urinary tract infections, kidney disease, diabetes, liver disorders, and other metabolic conditions.',
  
  group_level_prompt = 'COMPREHENSIVE URINE ROUTINE EXAMINATION (Urine R/M) - Complete Analysis Protocol

This is a complete urinalysis comprising THREE components:

1. PHYSICAL EXAMINATION:
   - Color: Assess visual appearance (pale yellow, yellow, amber, dark yellow, red, brown, etc.)
   - Appearance: Evaluate clarity (clear, slightly cloudy, cloudy, turbid)
   - Specific Gravity: Measure concentration (1.005-1.030)

2. CHEMICAL EXAMINATION (Dipstick):
   - Capture urine dipstick image with clear, even lighting
   - Ensure strip is fully in frame, aligned horizontally
   - Photograph within 60-120 seconds after dipping (critical timing)
   - Compare color changes precisely to manufacturer''s reference chart
   - Read parameters in sequence: Leukocytes, Nitrite, Urobilinogen, Protein, pH, Blood, Specific Gravity, Ketone, Bilirubin, Glucose
   - Use ordinal scale: NEG, TRACE, +1, +2, +3 (or specific values for pH and SG)

3. MICROSCOPIC EXAMINATION:
   - Analyze sediment under microscope (400x magnification)
   - Count cellular elements per High Power Field (HPF)
   - Identify and quantify: RBC, WBC, Epithelial cells
   - Detect presence of: Casts (hyaline, granular, RBC, WBC), Crystals (type and quantity), Bacteria, Yeast, Parasites

CLINICAL CORRELATION:
- UTI indicators: Positive Nitrite, Leukocyte Esterase, increased WBC, bacteria
- Kidney disease: Protein, Blood, RBC casts, cellular casts
- Diabetes: Glucose, Ketones
- Liver disease: Bilirubin, Urobilinogen
- Dehydration: High specific gravity, concentrated appearance
- Dilute urine: Low specific gravity, pale color

QUALITY REQUIREMENTS:
- Fresh specimen (< 2 hours old)
- Adequate volume (minimum 10-15 mL)
- Proper container (clean, sterile for culture)
- Midstream clean catch preferred
- Note any medications affecting results (e.g., vitamin C, antibiotics)

OUTPUT FORMAT:
Provide structured results for all parameters with reference ranges and clinical flags (High/Low/Abnormal). Organize by Physical, Chemical, and Microscopic sections.',

  ai_config = '{
    "model": "claude-3-5-sonnet-20241022",
    "config": {
      "examination_types": {
        "physical": {
          "parameters": ["Color", "Appearance", "Specific Gravity"],
          "method": "visual_inspection"
        },
        "chemical": {
          "parameters": ["Leukocytes", "Nitrite", "Urobilinogen", "Protein", "pH", "Blood", "Specific Gravity", "Ketone", "Bilirubin", "Glucose"],
          "method": "dipstick_colorimetry",
          "strip_order": ["Leukocytes", "Nitrite", "Urobilinogen", "Protein", "pH", "Blood", "Specific Gravity", "Ketone", "Bilirubin", "Glucose"],
          "timing_critical": true,
          "read_time_seconds": "60-120"
        },
        "microscopic": {
          "parameters": ["RBC", "WBC", "Epithelial Cells", "Casts", "Crystals", "Bacteria"],
          "method": "microscopy_400x",
          "unit": "/HPF"
        }
      },
      "ordinal_scale": {
        "numeric_pads": {
          "pH": {
            "values": ["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5"],
            "range": "4.5-8.5",
            "reference": "5.0-7.0"
          },
          "Specific Gravity": {
            "values": ["1.000", "1.005", "1.010", "1.015", "1.020", "1.025", "1.030"],
            "range": "1.000-1.030",
            "reference": "1.005-1.030"
          }
        },
        "chemical_pads": {
          "scale": ["NEG", "TRACE", "+1", "+2", "+3", "+4"],
          "interpretation": {
            "NEG": "Negative - baseline color",
            "TRACE": "Trace - very light tint",
            "+1": "Positive 1+ - light shade",
            "+2": "Positive 2+ - medium shade",
            "+3": "Positive 3+ - dark shade",
            "+4": "Positive 4+ - very dark/saturated"
          }
        },
        "microscopic_counts": {
          "RBC": {
            "reference": "0-2 /HPF",
            "abnormal_threshold": ">5 /HPF"
          },
          "WBC": {
            "reference": "0-5 /HPF",
            "abnormal_threshold": ">10 /HPF"
          },
          "Epithelial Cells": {
            "reference": "Few /HPF",
            "types": ["Squamous", "Transitional", "Renal tubular"]
          },
          "Casts": {
            "reference": "Absent",
            "types": ["Hyaline", "Granular", "RBC", "WBC", "Waxy", "Fatty"]
          },
          "Crystals": {
            "reference": "Absent or Few",
            "types": ["Uric acid", "Calcium oxalate", "Triple phosphate", "Cystine"]
          },
          "Bacteria": {
            "reference": "Absent",
            "significance": "Present = possible UTI"
          }
        }
      },
      "clinical_patterns": {
        "UTI": {
          "indicators": ["Nitrite +", "Leukocyte Esterase +", "WBC >10/HPF", "Bacteria present"],
          "confidence_threshold": 2
        },
        "Hematuria": {
          "indicators": ["Blood +", "RBC >5/HPF"],
          "types": ["Glomerular (RBC casts)", "Non-glomerular (no casts)"]
        },
        "Proteinuria": {
          "indicators": ["Protein +1 or higher"],
          "significance": "Kidney disease, diabetes, hypertension"
        },
        "Diabetes": {
          "indicators": ["Glucose +", "Ketones +"],
          "note": "Glucosuria with ketonuria suggests uncontrolled diabetes"
        },
        "Liver_Disease": {
          "indicators": ["Bilirubin +", "Urobilinogen increased"],
          "types": ["Hepatocellular", "Obstructive"]
        }
      }
    },
    "reason": "Comprehensive three-part urinalysis (physical, chemical, microscopic) for complete urine evaluation",
    "warnings": [
      "Dipstick timing is critical - read at 60-120 seconds",
      "Microscopic examination requires trained personnel",
      "Fresh specimen essential - analyze within 2 hours",
      "Confirm positive dipstick results with microscopy",
      "Medications can cause false positives/negatives",
      "High vitamin C can cause false negative glucose/blood"
    ],
    "confidence": 0.98,
    "generated_at": "2026-01-06T10:16:43Z",
    "processing_type": "MULTI_COMPONENT_URINALYSIS",
    "requires_components": ["DIPSTICK_IMAGE", "MICROSCOPY_IMAGE", "PHYSICAL_OBSERVATION"]
  }'::jsonb,
  
  default_ai_processing_type = 'MULTI_COMPONENT_URINALYSIS',
  
  updated_at = NOW()

WHERE code = 'URM' 
  AND name = 'Urine Routine Examination';

-- Verify the update
SELECT 
  id,
  name,
  code,
  description,
  default_ai_processing_type,
  LENGTH(group_level_prompt) as prompt_length,
  LENGTH(ai_config::text) as config_length,
  updated_at
FROM global_test_catalog
WHERE code = 'URM';

-- Show the updated configuration
SELECT 
  name,
  code,
  default_ai_processing_type,
  LEFT(group_level_prompt, 200) || '...' as prompt_preview,
  ai_config->'config'->'examination_types' as examination_types,
  ai_config->'config'->'clinical_patterns' as clinical_patterns
FROM global_test_catalog
WHERE code = 'URM';
