# Gemini JSON Parsing Fix

## Issue Summary

**Error**: `extractedParameters.map is not a function`  
**Root Cause**: Gemini Vision API was returning raw text instead of JSON when processing custom prompts for vision_color type (specifically Blood Grouping tests with agglutination analysis).

## Problem Analysis

### Original Flow
1. User uploads Blood Grouping image
2. vision-ocr auto-detects `vision_color` processing type ✅
3. Frontend extracts detected type and passes to gemini-nlp ✅
4. gemini-nlp uses custom Blood Grouping prompt from database ✅
5. **Gemini returns raw text instead of JSON** ❌
6. JSON.parse() fails ❌
7. Error handler returns `{ rawText: "..." }` without `extractedParameters` array ❌
8. Frontend tries `extractedParameters.map()` → **TypeError** ❌

### Why Gemini Returned Raw Text

The custom Blood Grouping prompt from the ai_prompts table contained:
- Markdown formatting (bold text, headers)
- Conversational instructions
- Example JSON in code blocks
- Lack of explicit "JSON-only" enforcement

**Example problematic prompt structure:**
```
Here's a **Google Vision AI prompt** you can use for...
> **Task:** Analyze the given image...
> 5. Output format should be JSON:
> ```json
> { ... }
> ```
```

Gemini interpreted this as documentation/guidance rather than strict JSON-only output requirements.

## Solution Implemented

### 1. JSON Response Enforcement Function

Created `enforceJsonResponse()` function that wraps custom prompts with strong JSON-only instructions:

```typescript
function enforceJsonResponse(customPrompt: string): string {
  const jsonEnforcement = `
CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object
2. Do NOT include any explanatory text before or after the JSON
3. Do NOT use markdown code blocks like \`\`\`json
4. Start your response directly with { and end with }
5. Ensure all JSON is properly formatted and parseable

`;
  
  return jsonEnforcement + customPrompt + '\n\nRemember: Return ONLY the JSON object, nothing else.';
}
```

### 2. Updated Custom Prompt Usage

Modified gemini-nlp to enforce JSON when using custom prompts:

```typescript
} else if (aiPromptOverride && aiPromptOverride.trim().length > 0) {
  console.log('Using custom AI prompt override');
  // Enforce JSON-only response for custom prompts
  const enforcedPrompt = enforceJsonResponse(aiPromptOverride);
  prompt = applyAnalyteFocus(enforcedPrompt, focusAnalyteNames, extractionTargets);
  geminiResponse = await callGemini(prompt, geminiApiKey, originalBase64Image);
}
```

### 3. Improved Error Handling

Updated JSON parse error catch block to include empty `extractedParameters` array:

```typescript
catch (jsonError) {
  console.warn('Gemini response was not valid JSON, returning raw text');
  return new Response(
    JSON.stringify({ 
      rawText: cleanedResponse,
      extractedParameters: [], // Prevent .map() errors in frontend
      metadata: {
        // ... metadata
        parseError: true
      },
      message: 'Gemini response could not be parsed as JSON. Check if custom prompt properly instructs Gemini to return JSON only.' 
    })
  );
}
```

### 4. Enhanced matchParametersToAnalytes Function

Added handling for non-array inputs (custom JSON objects from vision_color):

```typescript
async function matchParametersToAnalytes(extractedParameters: any): Promise<any[]> {
  // Handle non-array inputs (e.g., custom JSON objects from vision_color)
  if (!Array.isArray(extractedParameters)) {
    console.log('extractedParameters is not an array, returning as-is wrapped in array');
    return [{ 
      customData: extractedParameters,
      matched: false,
      note: 'Custom vision analysis result - not standard parameter format'
    }];
  }

  // Handle empty array
  if (extractedParameters.length === 0) {
    return [];
  }

  // ... rest of matching logic
}
```

## Changes Made

### File: `supabase/functions/gemini-nlp/index.ts`

**Line 488-507**: Added `enforceJsonResponse()` function  
**Line 93-97**: Applied JSON enforcement to custom prompts  
**Line 406-422**: Added `extractedParameters: []` to error response  
**Line 678-697**: Enhanced `matchParametersToAnalytes` to handle non-array inputs

## Testing Instructions

1. **Test Blood Grouping with vision_color**:
   - Upload Blood Grouping test image
   - Verify vision-ocr detects `vision_color`
   - Verify gemini-nlp uses custom prompt with JSON enforcement
   - Verify Gemini returns valid JSON
   - Verify results are extracted correctly

2. **Test Error Handling**:
   - If Gemini still returns raw text, verify error message appears
   - Verify `extractedParameters: []` is included in response
   - Verify no `.map() is not a function` error occurs

3. **Test Other Processing Types**:
   - Verify `ocr_report` still works for printed reports
   - Verify `vision_card` still works for test cards
   - Verify standard lab results still parse correctly

## Expected Behavior After Fix

### Successful Flow:
```
User uploads Blood Grouping image
  → vision-ocr detects vision_color ✅
  → Frontend passes vision_color to gemini-nlp ✅
  → gemini-nlp uses enforced custom prompt ✅
  → Gemini returns JSON object ✅
  → JSON.parse() succeeds ✅
  → Results extracted and displayed ✅
```

### Fallback Flow (if JSON still fails):
```
Gemini returns raw text
  → JSON.parse() fails
  → Catch block returns { extractedParameters: [], rawText: "..." }
  → Frontend displays error message
  → No crash, user can retry
```

## Custom Prompt Best Practices

When creating custom prompts in the AI Prompt Manager:

1. **Focus on the analysis task**, not JSON formatting
2. **Don't include markdown formatting** (no **bold**, headers, etc.)
3. **Don't use code blocks** for example JSON
4. **Specify the exact JSON structure** as plain text
5. The system will automatically add JSON enforcement

**Good prompt example**:
```
Analyze the blood grouping card image for agglutination reactions.
Identify reactions in A, B, and D zones as Positive or Negative.
Return JSON with these fields:
A_reaction, B_reaction, D_reaction, Blood_Group, Rh_Factor, Final_Result
```

**Bad prompt example** (what we had):
```
Here's a **Google Vision AI prompt** you can use for...
> 5. Output format should be JSON:
> ```json
> { "A_reaction": "Positive/Negative" }
> ```
```

## Deployment Status

✅ **Deployed**: 2025-01-XX  
✅ **Function**: gemini-nlp  
✅ **Project**: scqhzbkkradflywariem

## Related Issues

- ✅ Fixed vision-ocr auto-detection priority
- ✅ Fixed vision-ocr return type
- ✅ Fixed frontend type passing
- ✅ **Fixed Gemini JSON parsing** (this document)

## Next Steps

1. Monitor Gemini responses for Blood Grouping tests
2. Update other custom prompts if they have similar formatting issues
3. Consider adding JSON extraction logic for responses that include text + JSON
4. Document prompt best practices for users

## Logs to Monitor

Watch for these log messages:
- ✅ `"Using custom AI prompt override"` - Custom prompt is being used
- ✅ `"Gemini response was not valid JSON"` - JSON parsing failed
- ✅ `"extractedParameters is not an array"` - Non-standard response format

## Success Metrics

- Blood Grouping tests successfully extract results
- No `TypeError: extractedParameters.map is not a function` errors
- Gemini returns valid JSON for custom prompts
- Custom prompts work across all processing types
