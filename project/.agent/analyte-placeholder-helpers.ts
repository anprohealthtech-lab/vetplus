// Add this function before renderTemplate() in the Edge Function

/**
 * Generate individual analyte placeholders for hardcoded template support
 * Converts analyte names to short keys and creates placeholders like:
 * {{ANALYTE_CREACT_VALUE}}, {{ANALYTE_CREACT_UNIT}}, etc.
 */
function generateAnalytePlaceholders(analytes: any[]): Record<string, any> {
  const placeholders: Record<string, any> = {};
  
  if (!analytes || analytes.length === 0) return placeholders;
  
  analytes.forEach((analyte) => {
    // Generate a short key from the analyte name
    const shortKey = generateAnalyteShortKey(analyte.parameter || analyte.name || analyte.test_name || '');
    
    if (!shortKey) return; // Skip if no valid name
    
    // Create placeholders for this analyte
    placeholders[`ANALYTE_${shortKey}_VALUE`] = analyte.value || '';
    placeholders[`ANALYTE_${shortKey}_UNIT`] = analyte.unit || '';
    placeholders[`ANALYTE_${shortKey}_REFERENCE`] = analyte.reference_range || '';
    placeholders[`ANALYTE_${shortKey}_FLAG`] = analyte.flag || '';
    
    // Also add display flag (H, L, etc.)
    placeholders[`ANALYTE_${shortKey}_DISPLAYFLAG`] = analyte.displayFlag || '';
  });
  
  return placeholders;
}

/**
 * Generate a short key from analyte name for placeholder purposes
 * Examples:
 * - "C-Reactive Protein (CRP)" -> "CREACT"
 * - "Hemoglobin" -> "HB"
 * - "Total White Blood Cell Count" -> "TWBC"
 */
function generateAnalyteShortKey(name: string): string {
  if (!name) return '';
  
  // Common abbreviations mapping
  const abbreviations: Record<string, string> = {
    'C-Reactive Protein (CRP)': 'CREACT',
    'C-Reactive Protein': 'CRP',
    'Hemoglobin': 'HB',
    'Hematocrit': 'HCT',
    'Total White Blood Cell Count': 'WBC',
    'White Blood Cell Count': 'WBC',
    'Red Blood Cell Count': 'RBC',
    'Platelet Count': 'PLT',
    'Mean Corpuscular Volume': 'MCV',
    'Mean Corpuscular Hemoglobin': 'MCH',
    'Mean Corpuscular Hemoglobin Concentration': 'MCHC',
    'Neutrophils': 'NEUT',
    'Lymphocytes': 'LYMPH',
    'Monocytes': 'MONO',
    'Eosinophils': 'EOS',
    'Basophils': 'BASO',
    'Alanine Aminotransferase': 'ALT',
    'Aspartate Aminotransferase': 'AST',
    'Alkaline Phosphatase': 'ALP',
    'Gamma-Glutamyl Transferase': 'GGT',
    'Total Bilirubin': 'TBIL',
    'Direct Bilirubin': 'DBIL',
    'Indirect Bilirubin': 'IBIL',
    'Total Protein': 'TP',
    'Albumin': 'ALB',
    'Globulin': 'GLOB',
    'Blood Urea Nitrogen': 'BUN',
    'Creatinine': 'CREAT',
    'Uric Acid': 'UA',
    'Glucose': 'GLU',
    'Fasting Blood Glucose': 'FBG',
    'Random Blood Glucose': 'RBG',
    'HbA1c': 'HBA1C',
    'Thyroid Stimulating Hormone': 'TSH',
    'T3': 'T3',
    'T4': 'T4',
    'Free T3': 'FT3',
    'Free T4': 'FT4',
  };
  
  // Check if we have a pre-defined abbreviation
  if (abbreviations[name]) {
    return abbreviations[name];
  }
  
  // Check for abbreviations in parentheses like "(CRP)"
  const parenthesesMatch = name.match(/\\(([A-Z]{2,})\\)/);
  if (parenthesesMatch) {
    return parenthesesMatch[1];
  }
  
  // Generate from initials
  // Remove special characters and split into words
  const cleaned = name.replace(/[^a-zA-Z0-9\\s-]/g, '');
  const words = cleaned.split(/\\s+/).filter(w => w.length > 0);
  
  // Take first letter of each word, or first 2 letters if only one word
  if (words.length === 0) return '';
  if (words.length === 1) {
    return words[0].substring(0, Math.min(4, words[0].length)).toUpperCase();
  }
  
  // Multi-word: use initials
  const initials = words.map(w => w[0]).join('').toUpperCase();
  
  // If too short, add first few letters of first significant word
  if (initials.length < 3 && words[0].length > 1) {
    return (words[0].substring(0, 3) + initials.substring(1)).toUpperCase();
  }
  
  return initials;
}

// Usage: Add this to the context preparation
// Before calling renderTemplate, do:
// const analytePlaceholders = generateAnalytePlaceholders(context.analytes || []);
// const enhancedContext = { ...context, ...analytePlaceholders };
// then pass enhancedContext to renderTemplate
