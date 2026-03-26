
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// --- Configuration (from environment variables) ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ""; 

// --- Interfaces ---
interface AnalyteCorrection {
  unit: string;
  reference_range: string;
  category: string;
  reference_range_male: string | null;
  reference_range_female: string | null;
  value_type: 'numeric' | 'text' | 'qualitative' | 'semi_quantitative' | 'descriptive';
  description: string | null;
  code: string;
  low_critical: string | null;
  high_critical: string | null;
  interpretation_low: string | null;
  interpretation_normal: string | null;
  interpretation_high: string | null;
}

// --- Main Logic ---
async function main() {
  console.log("🚀 Starting Comprehensive Analyte Audit (Claude 3.5 Haiku)...");

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes("YOUR_")) {
    console.error("❌ ANTHROPIC_API_KEY is missing/invalid.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // 1. Fetch Analytes created TODAY (Dec 21, 2025 or later ideally, but strict >= today)
  console.log("🔍 Scanning for analytes created today (Dec 21, 2025)...");
  
  const today = new Date().toISOString().split('T')[0]; // "2025-12-21"
  
  const { data: analytes, error } = await supabase
    .from('analytes')
    .select('id, name, unit, reference_range, category, code, description, reference_range_male, reference_range_female, value_type')
    .eq('is_global', true)
    .gte('created_at', '2000-12-21T00:00:00') 
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ Error fetching analytes:", error.message);
    process.exit(1);
  }

  if (!analytes || analytes.length === 0) {
    console.log("✅ No recent analytes found to audit!");
    return;
  }

  console.log(`found ${analytes.length} analytes to review.`);

  // 2. Process in Batches
  const BATCH_SIZE = 5;
  for (let i = 0; i < analytes.length; i += BATCH_SIZE) {
    const batch = analytes.slice(i, i + BATCH_SIZE);
    console.log(`\n🤖 Processing Batch ${i / BATCH_SIZE + 1} (${batch.length} items)...`);
    
    await Promise.all(batch.map(analyte => processAnalyte(analyte, anthropic, supabase)));
    
    // Rate limit buffer
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n✅ Comprehensive Audit completed.");
}

async function processAnalyte(analyte: any, anthropic: Anthropic, supabase: any) {
  const prompt = `
    You are a Medical Lab Data Specialist.
    Review this analyte: "${analyte.name}" (Code: ${analyte.code})
    
    Current Data:
    - Unit: ${analyte.unit}
    - Range: ${analyte.reference_range}
    
    Task: Provide a COMPREHENSIVE medical definition. Fill ALL fields.
    
    Fields Required:
    1. unit: Standard SI or conventional unit.
    2. reference_range: Standard general range.
    3. reference_range_male/female: Gender specific ranges (if applicable, else null).
    4. category: Specific category (Hematology, Biochemistry, Serology, Hormones, etc).
    5. value_type: 'numeric' | 'qualitative' | 'semi_quantitative' | 'descriptive'.
    6. description: A 1-sentence clinical description.
    7. low_critical / high_critical: Critical values for immediate alert (if numeric).
    8. interpretation_low / normal / high: Short clinical meaning for result levels (e.g. "Anemia", "Normal", "Polycythemia").
    
    Return JSON ONLY:
    {
      "unit": "string",
      "reference_range": "string",
      "reference_range_male": "string or null",
      "reference_range_female": "string or null",
      "category": "string",
      "value_type": "string",
      "description": "string",
      "low_critical": "string or null",
      "high_critical": "string or null",
      "interpretation_low": "string or null",
      "interpretation_normal": "string or null",
      "interpretation_high": "string or null"
    }
  `;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = msg.content[0];
    if (textBlock.type !== 'text') throw new Error("Unexpected response");
    
    const jsonStr = textBlock.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const correction: AnalyteCorrection = JSON.parse(jsonStr);

    // Update DB
    const { error: updateError } = await supabase
        .from('analytes')
        .update({
            unit: correction.unit,
            reference_range: correction.reference_range,
            reference_range_male: correction.reference_range_male,
            reference_range_female: correction.reference_range_female,
            category: correction.category,
            value_type: correction.value_type,
            description: correction.description,
            low_critical: correction.low_critical,
            high_critical: correction.high_critical,
            interpretation_low: correction.interpretation_low,
            interpretation_normal: correction.interpretation_normal,
            interpretation_high: correction.interpretation_high
        })
        .eq('id', analyte.id);

    if (updateError) {
            console.error(`      ❌ Update failed for ${analyte.name}:`, updateError.message);
    } else {
            console.log(`      ✅ Updated: ${analyte.name} -> [${correction.category}] Critical: ${correction.low_critical}-${correction.high_critical}`);
    }

  } catch (err) {
    console.error(`      ❌ Failed to process ${analyte.name}:`, err.message);
  }
}

main().catch(console.error);

