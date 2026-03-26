/**
 * populate_global_ai_config.ts
 * 
 * Script to populate AI processing configuration for global test catalog
 * using Claude 3.5 Haiku model.
 * 
 * This script:
 * 1. Fetches test groups from global_test_catalog one at a time
 * 2. Sends each to Claude 3.5 Haiku with the DefaultMethodSetter prompt
 * 3. Updates the database with specimen_type, department, ai_processing_type, and group_level_prompt
 * 
 * Usage: npx ts-node scripts/populate_global_ai_config.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS_MS = 500; // 500ms between requests to avoid rate limiting
const BATCH_SIZE = 10; // Process 10 at a time, then pause
const BATCH_PAUSE_MS = 2000; // 2 second pause between batches

// --- The DefaultMethodSetter System Prompt ---
const SYSTEM_PROMPT = `You are DefaultMethodSetter, an AI agent for a multi-tenant Laboratory Information Management System (LIMS).

Your role is to run ONCE when a test is created at the GLOBAL level and automatically assign:
1) the most appropriate DEFAULT data-capture method
2) a safe, editable baseline configuration
3) the correct Vision prompt template
4) confidence + review flags

You are NOT performing diagnosis.
You are NOT interpreting numeric clinical meaning.
You are only deciding HOW the test is visually or manually captured.

--------------------------------------------------------------------
INPUT (per test)
--------------------------------------------------------------------
You receive a single test. It may include:
- test_id (uuid)
- test_name (string)
- category (string, may be "Generated - AI")
- analytes (array of analyte names, optional)
- description (optional)
- discipline_hint (optional: Biochemistry, Hematology, Microbiology, etc.)

--------------------------------------------------------------------
ALLOWED CAPTURE METHODS (choose EXACTLY ONE)
--------------------------------------------------------------------
1) INSTRUMENT_SCREEN_OCR
2) THERMAL_SLIP_OCR
3) RAPID_CARD_LFA
4) COLOR_STRIP_MULTIPARAM
5) SINGLE_WELL_COLORIMETRIC
6) AGGLUTINATION_CARD
7) MICROSCOPY_MORPHOLOGY
8) ZONE_OF_INHIBITION
9) MENISCUS_SCALE_READING
10) SAMPLE_QUALITY_TUBE_CHECK
11) MANUAL_ENTRY_NO_VISION
12) UNKNOWN_NEEDS_REVIEW

--------------------------------------------------------------------
SPECIMEN TYPES (choose the most appropriate - must match sample_type enum)
--------------------------------------------------------------------
- EDTA Blood
- Serum
- Plasma
- Urine
- Stool
- CSF
- Sputum
- Swab
- Tissue
- Other
- Fluoride Plasma
- Citrated Plasma

--------------------------------------------------------------------
DEPARTMENTS (choose the most appropriate)
--------------------------------------------------------------------
- Biochemistry
- Hematology
- Immunology
- Microbiology
- Clinical Pathology
- Serology
- Histopathology
- Cytology
- Molecular Biology
- Toxicology
- Endocrinology
- Other

--------------------------------------------------------------------
CORE CLASSIFICATION RULES (DETERMINISTIC)
--------------------------------------------------------------------
• Analyzer-based tests (CBC, LFT, RFT, Electrolytes, TSH, HbA1c, Lipids):
  → THERMAL_SLIP_OCR (default)
  → INSTRUMENT_SCREEN_OCR if screen-photo workflow is common

• Urine dipstick / multipad strips:
  → COLOR_STRIP_MULTIPARAM
  → needs_manual_upload = true

• Rapid card / cassette tests (HIV, HBsAg, Dengue, Malaria, HCG):
  → RAPID_CARD_LFA
  → Multi-line cards require manual to confirm T1/T2 logic

• Blood grouping / latex / slide agglutination:
  → AGGLUTINATION_CARD

• Smear, sediment, parasite ID:
  → MICROSCOPY_MORPHOLOGY

• Culture & Sensitivity / Antibiogram / Disc diffusion:
  → ZONE_OF_INHIBITION
  → needs_manual_upload = true (for breakpoints)

• ESR / Westergren / graduated tubes:
  → MENISCUS_SCALE_READING

• Hemolysis / Lipemia / Icterus checks:
  → SAMPLE_QUALITY_TUBE_CHECK

• Computed, interpretive, or non-visual tests:
  → MANUAL_ENTRY_NO_VISION

• If ambiguity exists:
  → UNKNOWN_NEEDS_REVIEW

--------------------------------------------------------------------
CRITICAL SAFETY RULES
--------------------------------------------------------------------
• NEVER invent numeric values, color charts, or clinical cutoffs
• NEVER assume manufacturer-specific calibration
• If calibration or breakpoints are required → needs_manual_upload = true
• If unsure → UNKNOWN_NEEDS_REVIEW with questions

--------------------------------------------------------------------
DEFAULT BASELINE CONFIG GENERATION
--------------------------------------------------------------------

### A) COLOR_STRIP_MULTIPARAM (Urine strips)
If no manual is available, ALWAYS generate this editable baseline:

- Standard pad order:
  ["Leukocytes","Nitrite","Urobilinogen","Protein","pH","Blood","Specific Gravity","Ketone","Bilirubin","Glucose"]

- Ordinal scale (editable):
  ["NEG","TRACE","+1","+2","+3"]

- Generic color ramp (descriptive only, NO numeric meaning):
  {
    "NEG":   "baseline / off-white",
    "TRACE": "very light tint",
    "+1":    "light shade",
    "+2":    "medium shade",
    "+3":    "dark / saturated shade"
  }

- Numeric pads (pH, SG):
  Output ONLY ["LOW","MID","HIGH","UNDETERMINED"]

- Set:
  needs_manual_upload = true
  warning = "Exact numeric interpretation requires manufacturer color chart."

---

### B) RAPID_CARD_LFA (HIV, HBsAg, Dengue, etc.)
Default generic rules (safe baseline):

- Control line (C) MUST be present
- Any visible Test line (T), even faint → POSITIVE
- C absent → INVALID
- If test suggests multiple targets (T1/T2):
  → needs_manual_upload = true
  → interpretation = UNDETERMINED until manual confirms logic

---

### C) AGGLUTINATION_CARD
Default visual logic:
- Clumping / granularity → POSITIVE
- Smooth homogeneous suspension → NEGATIVE
- No grading unless manual provided

---

### D) ZONE_OF_INHIBITION
Default behavior without breakpoints:
- Measure zone presence visually
- Classify as "ZONE PRESENT" or "NO ZONE"
- S/R interpretation requires manual
- needs_manual_upload = true

---

### E) INSTRUMENT_SCREEN_OCR / THERMAL_SLIP_OCR
- Extract values exactly as seen
- Allow partial / uncertain digits
- NEVER normalize or correct values
- Flag implausible magnitudes

--------------------------------------------------------------------
OUTPUT FORMAT (STRICT JSON)
--------------------------------------------------------------------
Return one JSON object:

{
  "test_id": "...",
  "test_name": "...",
  "specimen_type": "Serum|Plasma|Whole Blood|...",
  "department": "Biochemistry|Hematology|...",
  "chosen_method": "THERMAL_SLIP_OCR|RAPID_CARD_LFA|...",
  "confidence": 0.0-1.0,
  "reason": "Why this method was selected",
  "needs_manual_upload": true|false,
  "config": { ...method-specific baseline config... },
  "vision_prompt": "Final Vision prompt text for AI processing",
  "warnings": ["Optional warnings"]
}

--------------------------------------------------------------------
VISION PROMPT CONSTRUCTION
--------------------------------------------------------------------
• Use the appropriate canonical Vision template
• Inject ONLY generic logic unless calibration is supplied
• Explicitly state when results may be UNDETERMINED
• Never hallucinate numeric mappings

--------------------------------------------------------------------
FINAL INSTRUCTION
--------------------------------------------------------------------
Process the provided GLOBAL test.
Assign safe, editable defaults.
Prefer conservative classification over guessing.`;

// --- Helper: Call Claude 3.5 Haiku ---
async function analyzeWithHaiku(testInput: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is missing in .env");

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const msg = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022", // Using Claude 3.5 Haiku as requested
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: testInput }]
  });

  // Extract text content safely
  const content = msg.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  return "";
}

// --- Helper: Parse AI Response ---
function parseAIResponse(response: string): any | null {
  try {
    // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("   ❌ No JSON found in response");
      return null;
    }
    return JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    console.error(`   ❌ Failed to parse JSON: ${e.message}`);
    return null;
  }
}

// --- Helper: Delay ---
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main Script ---
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 Global Test Catalog AI Configuration Script");
  console.log("   Using Claude 3.5 Haiku for DefaultMethodSetter");
  console.log("=".repeat(60));

  // Validate environment
  if (!ANTHROPIC_API_KEY) {
    console.error("❌ Please set ANTHROPIC_API_KEY environment variable.");
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Fetch all test groups that need processing
  console.log("\n📊 Fetching test groups from global_test_catalog...");
  
  const { data: testGroups, error: fetchError } = await supabase
    .from('global_test_catalog')
    .select('id, name, code, category, description, analytes')
    .is('default_ai_processing_type', null) // Only process those not yet configured
    .order('name');

  if (fetchError) {
    console.error(`❌ Failed to fetch test groups: ${fetchError.message}`);
    process.exit(1);
  }

  if (!testGroups || testGroups.length === 0) {
    console.log("✅ All test groups already have AI configuration. Nothing to process.");
    return;
  }

  console.log(`   Found ${testGroups.length} test groups to process.`);

  // 2. Fetch analyte names for lookup
  console.log("\n📋 Fetching analyte names for context...");
  const { data: analytes } = await supabase
    .from('analytes')
    .select('id, name, category');

  const analyteMap = new Map(analytes?.map(a => [a.id, { name: a.name, category: a.category }]) || []);

  // 3. Process each test group
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  console.log("\n🤖 Starting AI processing...\n");

  for (let i = 0; i < testGroups.length; i++) {
    const testGroup = testGroups[i];
    processed++;

    console.log(`[${processed}/${testGroups.length}] Processing: ${testGroup.name} (${testGroup.code})`);

    // Resolve analyte names
    let analyteNames: string[] = [];
    if (testGroup.analytes) {
      try {
        const analyteIds = typeof testGroup.analytes === 'string' 
          ? JSON.parse(testGroup.analytes) 
          : testGroup.analytes;
        
        if (Array.isArray(analyteIds)) {
          analyteNames = analyteIds
            .map((id: string) => analyteMap.get(id)?.name || id)
            .filter(Boolean);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Prepare input for AI
    const testInput = JSON.stringify({
      test_id: testGroup.id,
      test_name: testGroup.name,
      category: testGroup.category || "Unknown",
      description: testGroup.description || "",
      analytes: analyteNames,
      discipline_hint: testGroup.category
    }, null, 2);

    try {
      // Call Claude 3.5 Haiku
      const aiResponse = await analyzeWithHaiku(testInput);
      const parsed = parseAIResponse(aiResponse);

      if (!parsed) {
        console.log(`   ⚠️ Skipping due to parse error`);
        failed++;
        continue;
      }

      // Validate required fields
      if (!parsed.chosen_method || !parsed.department || !parsed.specimen_type) {
        console.log(`   ⚠️ Missing required fields in AI response`);
        failed++;
        continue;
      }

      // Normalize specimen_type to match sample_type enum
      const normalizeSpecimenType = (type: string): string => {
        const mapping: Record<string, string> = {
          'Whole Blood': 'EDTA Blood',
          'Arterial Blood': 'EDTA Blood',
          'Venous Blood': 'EDTA Blood',
          'Citrated Blood': 'Citrated Plasma',
          'Bone Marrow': 'Other',
          'Bone Marrow Aspirate': 'Other',
          'Blood Culture': 'EDTA Blood',
          'Aspirate': 'Other',
          'Biopsy': 'Tissue',
          'Urine (Random)': 'Urine',
          'Urine (24hr)': 'Urine',
          'Body Fluid': 'Other',
          'Pleural Fluid': 'Other',
          'Peritoneal Fluid': 'Other',
          'Synovial Fluid': 'Other',
        };
        return mapping[type] || type;
      };

      // Normalize department to match department_check enum
      const normalizeDepartment = (dept: string): string => {
        const mapping: Record<string, string> = {
          'Virology': 'Molecular Biology',
          'Molecular Diagnostics': 'Molecular Biology',
          'Clinical Chemistry': 'Biochemistry',
          'Clinical Hematology': 'Hematology',
          'Clinical Microbiology': 'Microbiology',
          'Parasitology': 'Microbiology',
          'Mycology': 'Microbiology',
          'Bacteriology': 'Microbiology',
          'Coagulation': 'Hematology',
          'Blood Bank': 'Hematology',
          'Transfusion Medicine': 'Hematology',
          'Anatomical Pathology': 'Histopathology',
          'Surgical Pathology': 'Histopathology',
        };
        return mapping[dept] || dept;
      };

      const normalizedSpecimen = normalizeSpecimenType(parsed.specimen_type);
      const normalizedDepartment = normalizeDepartment(parsed.department);

      // Update the database
      const updatePayload = {
        specimen_type_default: normalizedSpecimen,
        department_default: normalizedDepartment,
        default_ai_processing_type: parsed.chosen_method,
        group_level_prompt: parsed.vision_prompt || null,
        ai_config: {
          confidence: parsed.confidence || 0,
          reason: parsed.reason || "",
          needs_manual_upload: parsed.needs_manual_upload || false,
          config: parsed.config || {},
          warnings: parsed.warnings || [],
          generated_at: new Date().toISOString(),
          model: "claude-3-5-haiku-20241022",
          original_specimen_type: parsed.specimen_type, // Keep original for reference
          original_department: parsed.department
        },
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('global_test_catalog')
        .update(updatePayload)
        .eq('id', testGroup.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        failed++;
      } else {
        console.log(`   ✅ ${parsed.chosen_method} | ${parsed.department} | ${parsed.specimen_type} (conf: ${parsed.confidence})`);
        succeeded++;
      }

    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message}`);
      failed++;
    }

    // Rate limiting
    await delay(DELAY_BETWEEN_REQUESTS_MS);

    // Batch pause
    if (processed % BATCH_SIZE === 0 && processed < testGroups.length) {
      console.log(`\n   ⏸️ Batch pause (${BATCH_PAUSE_MS}ms)...\n`);
      await delay(BATCH_PAUSE_MS);
    }
  }

  // 4. Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(`   Total Processed: ${processed}`);
  console.log(`   ✅ Succeeded: ${succeeded}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log("=".repeat(60));

  // 5. Show remaining unconfigured
  const { count } = await supabase
    .from('global_test_catalog')
    .select('id', { count: 'exact', head: true })
    .is('default_ai_processing_type', null);

  if (count && count > 0) {
    console.log(`\n⚠️ ${count} test groups still need configuration.`);
    console.log("   Run this script again to process them.");
  } else {
    console.log("\n🎉 All test groups are now configured!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
