
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.limsapp.in';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U';
const CSV_FILE_PATH = 'scripts/required_tests.csv'; // Expects a CSV with a column 'Test Name'

// --- Interfaces ---
interface GlobalTestGroup {
  id: string;
  name: string;
  code: string;
  desc?: string;
}

interface MatchResult {
  requiredName: string;
  matchType: 'EXACT' | 'FUZZY' | 'MISSING';
  matchedName?: string;
  matchedCode?: string;
  score: number;
}

// --- Fuzzy Logic (Levenshtein Distance) ---
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  let i, j;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  for (i = 0; i <= b.length; i++) matrix[i] = [i];
  for (j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getSimilarity(a: string, b: string): number {
  const distance = getLevenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const longest = Math.max(a.length, b.length);
  return (longest - distance) / longest;
}

// --- Main Execution ---
async function main() {
  console.log('🔄 Connecting to Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Fetch Global Catalog
  console.log('📥 Fetching Global Test Catalog...');
  const { data: globalTests, error } = await supabase
    .from('global_test_catalog')
    .select('id, name, code');

  if (error || !globalTests) {
    console.error('❌ Error fetching global tests:', error);
    process.exit(1);
  }
  console.log(`✅ Loaded ${globalTests.length} global test groups.`);

  // 2. Read Local CSV
  console.log(`📖 Reading ${CSV_FILE_PATH}...`);
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ File not found: ${CSV_FILE_PATH}`);
    console.log('👉 Please create this file with a list of test names (one per line or CSV).');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  const requiredTests = fileContent
    .split('\n')
    .map(line => line.split(',')[0].trim()) // Assume first column is name
    .filter(line => line.length > 0 && line !== 'Test Name'); // Skip header and empty lines

  console.log(`✅ Found ${requiredTests.length} tests in list.`);

  // 3. Perform Matching
  console.log('🔍 Comparing lists (Fuzzy Matching)...');
  const results: MatchResult[] = [];

  for (const reqName of requiredTests) {
    let bestMatch: GlobalTestGroup | null = null;
    let bestScore = 0;

    for (const globalTest of globalTests) {
      if (globalTest.name.toLowerCase() === reqName.toLowerCase()) {
        bestMatch = globalTest;
        bestScore = 1.0;
        break; // Exact match found
      }

      const score = getSimilarity(reqName, globalTest.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = globalTest;
      }
    }

    if (bestScore === 1.0) {
      results.push({ requiredName: reqName, matchType: 'EXACT', matchedName: bestMatch?.name, matchedCode: bestMatch?.code, score: 1.0 });
    } else if (bestScore > 0.6) { // Threshold for "Close Enough"
      results.push({ requiredName: reqName, matchType: 'FUZZY', matchedName: bestMatch?.name, matchedCode: bestMatch?.code, score: bestScore });
    } else {
      results.push({ requiredName: reqName, matchType: 'MISSING', score: bestScore });
    }
  }

  // 4. Output Report
  console.log('\n--- 📊 Analysis Report ---');
  
  const missing = results.filter(r => r.matchType === 'MISSING');
  const fuzzy = results.filter(r => r.matchType === 'FUZZY');
  const exact = results.filter(r => r.matchType === 'EXACT');

  console.log(`✅ Exact Matches: ${exact.length}`);
  console.log(`⚠️  Potential Matches: ${fuzzy.length}`);
  console.log(`❌ Missing: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\n❌ MISSING ITEMS (Need to be created in Global Catalog):');
    missing.forEach(r => console.log(` - ${r.requiredName}`));
  }

  if (fuzzy.length > 0) {
    console.log('\n⚠️  POTENTIAL MATCHES (Verify these):');
    fuzzy.forEach(r => console.log(` - "${r.requiredName}" might be "${r.matchedName}" (${(r.score * 100).toFixed(0)}%)`));
  }

  // 5. Generate CSV Output
  const outputCsv = [
    'Required Name,Match Status,Matched Global Name,Matched Code,Confidence',
    ...results.map(r => `"${r.requiredName}",${r.matchType},"${r.matchedName || ''}",${r.matchedCode || ''},${(r.score * 100).toFixed(0)}%`)
  ].join('\n');

  fs.writeFileSync('coverage_report.csv', outputCsv);
  console.log('\n✅ Detailed report saved to: coverage_report.csv');
}

main().catch(console.error);
