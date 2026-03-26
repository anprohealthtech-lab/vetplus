// Test script - processes only 5 analytes from 1 lab to check for errors
// Run: node scripts/test-embeddings.mjs

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U';
const EDGE_FUNCTION_URL = 'https://scqhzbkkradflywariem.supabase.co/functions/v1/generate-catalog-embeddings';

// Test with first lab, limit to 5 analytes
const TEST_LAB_ID = '2f8d0329-d584-4423-91f6-9ab326b700ae';
const LIMIT = 5;

console.log('🧪 Testing embedding generation...\n');
console.log(`Lab: ${TEST_LAB_ID}`);
console.log(`Limit: ${LIMIT} analytes\n`);

try {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      labId: TEST_LAB_ID,
      limit: LIMIT 
    }),
  });

  console.log(`📡 Response status: ${response.status}\n`);
  
  const responseText = await response.text();
  console.log('📄 Full response:');
  console.log(responseText);
  console.log('\n');
  
  const result = JSON.parse(responseText);
  
  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log(`   Generated: ${result.count} embeddings`);
    console.log(`   Analytes processed: ${result.analytesProcessed}`);
  } else {
    console.log('❌ FAILED!');
    console.log(`   Error: ${result.error}`);
  }

} catch (error) {
  console.log('❌ Script error:', error.message);
}
