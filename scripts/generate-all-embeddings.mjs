// One-time script to generate embeddings for all labs
// Run: node scripts/generate-all-embeddings.mjs

const labIds = [
  '2f8d0329-d584-4423-91f6-9ab326b700ae',
  '82a30c78-ddb3-4a0c-95d3-cef446dcae29',
  '373e821a-447b-4bcb-9859-4b695f5dfbba',
];

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U';
const EDGE_FUNCTION_URL = 'https://scqhzbkkradflywariem.supabase.co/functions/v1/generate-catalog-embeddings';

console.log('🚀 Starting embedding generation for all labs...\n');

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < labIds.length; i++) {
  const labId = labIds[i];
  console.log(`📊 [${i + 1}/${labIds.length}] Processing lab: ${labId}`);
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labId }),
    });

    console.log(`   📡 Response status: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`   📄 Raw response: ${responseText.substring(0, 200)}`);
    
    const result = JSON.parse(responseText);
    
    if (result.success) {
      console.log(`   ✅ Success: ${result.message}`);
      console.log(`   📈 Generated ${result.count} embeddings for ${result.analytesProcessed} analytes\n`);
      successCount++;
    } else {
      console.log(`   ❌ Error: ${result.error}\n`);
      errorCount++;
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}\n`);
    errorCount++;
  }

  // Small delay between labs
  if (i < labIds.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 Final Summary:');
console.log(`   ✅ Successful: ${successCount}/${labIds.length}`);
console.log(`   ❌ Failed: ${errorCount}/${labIds.length}`);
console.log('='.repeat(60));
