/**
 * DigitalOcean Function: Search Placeholders
 * Searches for report template placeholders using natural language
 */

const SUPABASE_URL = 'https://scqhzbkkradflywariem.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U';

async function main(args) {
  let userQuery = args.userQuery || '';
  let labId = args.labId || '';
  let matchThreshold = args.matchThreshold || 0.7;
  let matchCount = args.matchCount || 5;

  // Validate
  if (!userQuery) {
    return { body: { success: false, error: 'userQuery is required' } };
  }
  if (!labId) {
    return { body: { success: false, error: 'labId is required' } };
  }

  try {
    // Call Supabase edge function
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ai-placeholder-search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userQuery,
          labId,
          matchThreshold,
          matchCount
        })
      }
    );

    const result = await response.json();
    
    console.log('Search result:', result);
    
    return { body: result };

  } catch (error) {
    console.error('Function error:', error);
    return { 
      body: { 
        success: false, 
        error: error.message 
      } 
    };
  }
}
