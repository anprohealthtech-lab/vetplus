/**
 * DigitalOcean Function - AI Placeholder Search
 * Calls Supabase edge function to get placeholder suggestions
 * 
 * Deploy to: DigitalOcean App Platform or Functions
 */

// Configuration
const SUPABASE_PROJECT_URL = 'https://scqhzbkkradflywariem.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U';

/**
 * Main function handler
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function main(req, res) {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Parse request body
    const { userQuery, labId, matchThreshold, matchCount } = req.body;

    // Validate inputs
    if (!userQuery || !labId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userQuery and labId'
      });
    }

    console.log(`[AI Search] Query: "${userQuery}" for lab: ${labId}`);

    // Call Supabase edge function
    const response = await fetch(
      `${SUPABASE_PROJECT_URL}/functions/v1/ai-placeholder-search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          labId,
          matchThreshold: matchThreshold || 0.7,
          matchCount: matchCount || 5,
        }),
      }
    );

    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Search] Edge function error:`, errorText);
      return res.status(response.status).json({
        success: false,
        error: `Edge function failed: ${errorText}`
      });
    }

    // Parse result
    const result = await response.json();

    if (!result.success) {
      console.error(`[AI Search] Search failed:`, result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Format response for bot
    const formattedSuggestions = result.suggestions.map((s, index) => ({
      rank: index + 1,
      placeholder: s.placeholder,
      displayName: s.displayName,
      confidence: Math.round(s.confidence * 100),
      category: s.category,
      context: s.context,
      unit: s.unit,
      referenceRange: s.referenceRange,
      insertHtml: s.insertHtml,
      // Quick copy text
      copyText: s.placeholder,
    }));

    console.log(`[AI Search] Found ${formattedSuggestions.length} suggestions`);

    // Return success
    return res.status(200).json({
      success: true,
      query: userQuery,
      labId: labId,
      suggestions: formattedSuggestions,
      totalResults: formattedSuggestions.length,
      // Bot-friendly message
      message: formattedSuggestions.length > 0
        ? `Found ${formattedSuggestions.length} placeholder suggestions for "${userQuery}"`
        : `No placeholders found for "${userQuery}". Try different keywords.`
    });

  } catch (error) {
    console.error('[AI Search] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Export for DigitalOcean Functions
module.exports = main;

// For local testing with Node.js
if (require.main === module) {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  app.post('/search', main);
  app.options('/search', main);
  
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`🚀 AI Placeholder Search running on port ${PORT}`);
    console.log(`Test: curl -X POST http://localhost:${PORT}/search -H "Content-Type: application/json" -d '{"userQuery":"hemoglobin","labId":"2f8d0329-d584-4423-91f6-9ab326b700ae"}'`);
  });
}
