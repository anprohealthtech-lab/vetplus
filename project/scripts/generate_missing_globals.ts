
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration (from environment variables) ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ""; 
const CSV_FILE_PATH = "coverage_report.csv"; // Note: User ran analyze from root, so file is at root of cwd usually

// --- Interfaces ---
interface GeneratedAnalyte {
  name: string;
  unit: string;
  reference_range: string;
  gender_specific_ranges?: { male: string; female: string };
  code?: string;
}

interface GeneratedTestGroup {
  name: string;
  clinical_purpose: string;
  analytes: GeneratedAnalyte[];
}

// --- Main Logic ---
async function main() {
  console.log("🚀 Starting AI Generation Script (Claude 3.5 Haiku)...");

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_ANTHROPIC_KEY") {
    console.error("❌ ANTHROPIC_API_KEY is missing. Please set it in .env or provide it inline.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });

  // 1. Read CSV & Filter Missing
  console.log("📖 Reading CSV...");
  if (!fs.existsSync(CSV_FILE_PATH)) {
     console.error(`❌ File not found: ${CSV_FILE_PATH}`);
     process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  const lines = fileContent.split('\n');
  
  // Custom CSV parse handling quotes roughly
  const missingTests: string[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma, but respect quotes. Simple regex split for CSV lines:
    // This regex splits by comma but ignores commas inside quotes
    const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (cols && cols.length >= 2) {
       // Col 0: Name, Col 1: Status
       // Clean quotes
       const name = cols[0].replace(/^"|"$/g, '').trim();
       const status = cols[1].replace(/^"|"$/g, '').trim();
       
       if (status === "MISSING" && name.length > 0) {
           missingTests.push(name);
       }
    }
  }

  console.log(`🔍 Found ${missingTests.length} MISSING test groups.`);

  // 2. Process in Batches
  const BATCH_SIZE = 5; 
  for (let i = 0; i < missingTests.length; i += BATCH_SIZE) {
    const batch = missingTests.slice(i, i + BATCH_SIZE);
    console.log(`\n🤖 Processing Batch ${i / BATCH_SIZE + 1} (${batch.length} tests)...`);
    
    // Serial processing within batch to avoid hitting concurrency limits too hard
    for (const testName of batch) {
      await processTestGroup(testName, anthropic, supabase);
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log("\n✅ Script completed.");
}

async function processTestGroup(testName: string, anthropic: Anthropic, supabase: any) {
  console.log(`   👉 Generating data for: "${testName}"`);
  
  const prompt = `
    You are a Medical Laboratory Data Architect.
    Task: Create a structured definition for the lab test: "${testName}".
    
    Return a single valid JSON object. No markdown, no explanations.
    Structure:
    {
      "name": "${testName}",
      "clinical_purpose": "Short description of what this test measures",
      "analytes": [
        {
          "name": "Standard Analyte Name",
          "unit": "Unit (e.g. mg/dL, %, or N/A)",
          "reference_range": "Normal range (e.g. 10-40) or 'Negative'",
          "code": "Short unique code (e.g. HB for Hemoglobin)"
        }
      ]
    }
    
    Rules:
    1. If "${testName}" is a profile (e.g. "Liver Function Test"), include ALL standard analytes.
    2. If it is a single test, include just 1 analyte.
    3. Use standard medical units and ranges.
  `;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = msg.content[0];
    if (textBlock.type !== 'text') throw new Error("Unexpected response type");
    
    let text = textBlock.text;
    // Clean markdown if present
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const data: GeneratedTestGroup = JSON.parse(text);

    // --- Insert into DB ---
    // 1. Create/Find Analytes
    const analyteIds: string[] = [];
    
    for (const ana of data.analytes) {
        // Reuse existing global analytes if name matches exactly
        const { data: existing } = await supabase
            .from('analytes')
            .select('id')
            .eq('name', ana.name)
            .eq('is_global', true)
            .maybeSingle();

        let aid = existing?.id;

        if (!aid) {
            const { data: newAna, error: naError } = await supabase
                .from('analytes')
                .insert({
                    name: ana.name,
                    unit: ana.unit || 'N/A', // Fallback
                    reference_range: ana.reference_range || 'N/A', // Fallback
                    is_global: true,
                    category: 'General', // Default category to satisfy NOT NULL constraint
                    code: ana.code || ana.name.substring(0, 4).toUpperCase()
                })
                .select('id')
                .single();
            
            if (newAna) aid = newAna.id;
            if (naError) console.error(`      ❌ Error creating analyte ${ana.name}:`, naError.message);
        }

        if (aid) analyteIds.push(aid);
    }

    // 2. Create Global Test Catalog Entry
    // Check if exists first to avoid duplicates on re-run
    const { data: existingGroup } = await supabase
        .from('global_test_catalog')
        .select('id')
        .eq('name', data.name)
        .maybeSingle();

    if (existingGroup) {
        console.log(`      ⚠️  Skipping: ${data.name} (Already exists)`);
        return;
    }

    const testCode = testName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() + Math.round(Math.random() * 999);

    const { error: gtcError } = await supabase
        .from('global_test_catalog')
        .insert({
            name: data.name,
            code: testCode,
            description: data.clinical_purpose,
            analytes: analyteIds,
            category: 'Generated - AI'
        });

    if (gtcError) {
        // Handle duplicate code by retrying once or just logging
         console.error(`      ❌ Error creating Global Test Group:`, gtcError.message);
    } else {
        console.log(`      ✅ Created: ${data.name} (${analyteIds.length} analytes)`);
    }

  } catch (err) {
    console.error(`      ❌ Generation Failed for ${testName}:`, err.message);
  }
}

main().catch(console.error);
