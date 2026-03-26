# AI Result Value Analysis - Usage Guide

## Overview
This system provides AI-powered analysis for individual result values, generating:
1. **Suggested Flag** (L/H/C/N) based on reference range
2. **Value Interpretation** - Clinical meaning of this specific result
3. **Trend Interpretation** - Analysis of value changes over time (if historical data available)

## Key Changes from Previous System

### ❌ OLD: Saved to `lab_analytes` table (master data)
```typescript
// OLD - Don't use anymore
saveInterpretationsToDb(labId, interpretations);
```

### ✅ NEW: Saves to `result_values` table (per-result AI suggestions)
```typescript
// NEW - Use this approach
generateResultValueSuggestions(resultValues, patient, trendData);
saveResultValueSuggestions(suggestions);
```

## Integration Examples

### 1. Basic Usage - Analyze Result Values
```typescript
import { useAIResultIntelligence } from '../hooks/useAIResultIntelligence';

const ResultEntry = () => {
  const { generateResultValueSuggestions, saveResultValueSuggestions, loading } = useAIResultIntelligence();
  
  const handleAnalyzeResults = async (resultValues: ResultValue[]) => {
    try {
      // Call AI to analyze result values
      const suggestions = await generateResultValueSuggestions(
        resultValues,
        {
          age: patient.age,
          gender: patient.gender,
          clinical_notes: order.clinical_notes
        }
      );
      
      // suggestions now contain:
      // - ai_suggested_flag
      // - ai_suggested_interpretation
      // - trend_interpretation (if historical data was provided)
      
      // Save to database
      const result = await saveResultValueSuggestions(suggestions);
      console.log(`Saved ${result.success} suggestions, ${result.failed} failed`);
      
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  };
  
  return (
    <button onClick={() => handleAnalyzeResults(currentResults)} disabled={loading}>
      {loading ? 'Analyzing...' : 'Get AI Suggestions'}
    </button>
  );
};
```

### 2. With Historical Trend Data
```typescript
const analyzeWithTrends = async (currentResultValues: ResultValue[]) => {
  // Fetch historical data for the same analytes
  const historicalData = await fetchHistoricalResults(patientId, analyteIds);
  
  // Enrich result values with historical data
  const enrichedResults = currentResultValues.map(rv => ({
    ...rv,
    historical_values: historicalData
      .filter(h => h.analyte_id === rv.analyte_id)
      .map(h => ({
        date: h.created_at,
        value: h.value,
        flag: h.flag
      }))
  }));
  
  // AI will now include trend analysis
  const suggestions = await generateResultValueSuggestions(
    enrichedResults,
    patient
  );
  
  // suggestions will have trend_interpretation populated
  suggestions.forEach(s => {
    console.log(`${s.analyte_name}: ${s.trend_interpretation}`);
  });
};
```

### 3. Display AI Suggestions in Verification UI
```typescript
const ResultValueCard = ({ resultValue }: { resultValue: ResultValue }) => {
  const [flag, setFlag] = useState(resultValue.flag || resultValue.ai_suggested_flag);
  const [interpretation, setInterpretation] = useState(
    resultValue.interpretation || resultValue.ai_suggested_interpretation
  );
  
  const hasAISuggestion = resultValue.ai_suggested_flag || resultValue.ai_suggested_interpretation;
  const flagChanged = flag !== resultValue.ai_suggested_flag;
  const interpretationChanged = interpretation !== resultValue.ai_suggested_interpretation;
  
  return (
    <div className="border rounded-lg p-4">
      {/* Result Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-semibold text-lg">{resultValue.analyte_name}</h4>
          <p className="text-3xl font-bold text-gray-900">
            {resultValue.value} <span className="text-lg text-gray-600">{resultValue.unit}</span>
          </p>
          <p className="text-sm text-gray-600">Reference: {resultValue.reference_range}</p>
        </div>
        
        {/* Flag Selector */}
        <div className="flex flex-col items-end">
          <label className="text-xs text-gray-600 mb-1">Flag</label>
          <select 
            value={flag || ''}
            onChange={(e) => setFlag(e.target.value || null)}
            className={`px-3 py-2 border rounded ${flagChanged ? 'border-yellow-500 bg-yellow-50' : ''}`}
          >
            <option value="">Normal</option>
            <option value="L">Low ↓</option>
            <option value="H">High ↑</option>
            <option value="C">Critical ⚠️</option>
          </select>
          {flagChanged && (
            <span className="text-xs text-yellow-700 mt-1">Modified from AI</span>
          )}
        </div>
      </div>
      
      {/* AI Suggestions Panel */}
      {hasAISuggestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z"/>
            </svg>
            <span className="text-sm font-semibold text-blue-900">AI Suggestion</span>
          </div>
          
          {resultValue.ai_suggested_flag && (
            <p className="text-sm text-blue-800 mb-2">
              <strong>Flag:</strong> {
                resultValue.ai_suggested_flag === 'L' ? 'Low ↓' :
                resultValue.ai_suggested_flag === 'H' ? 'High ↑' :
                resultValue.ai_suggested_flag === 'C' ? 'Critical ⚠️' : 'Normal'
              }
            </p>
          )}
          
          {resultValue.ai_suggested_interpretation && (
            <p className="text-sm text-blue-800">
              <strong>Interpretation:</strong> {resultValue.ai_suggested_interpretation}
            </p>
          )}
          
          {resultValue.trend_interpretation && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Trend:</strong> {resultValue.trend_interpretation}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Interpretation Editor */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Clinical Interpretation
          {interpretationChanged && <span className="text-yellow-600 ml-2">(Modified)</span>}
        </label>
        <textarea
          value={interpretation || ''}
          onChange={(e) => setInterpretation(e.target.value)}
          placeholder="Add clinical interpretation..."
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        {hasAISuggestion && (
          <button
            onClick={() => {
              setFlag(resultValue.ai_suggested_flag);
              setInterpretation(resultValue.ai_suggested_interpretation);
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Accept AI Suggestion
          </button>
        )}
        <button
          onClick={() => applyChanges(resultValue.id, flag, interpretation)}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};
```

### 4. Batch Analysis for Multiple Result Values
```typescript
const ResultVerificationConsole = () => {
  const { generateResultValueSuggestions, saveResultValueSuggestions, loading } = useAIResultIntelligence();
  const [results, setResults] = useState<Result[]>([]);
  
  const handleBatchAIAnalysis = async () => {
    try {
      // Collect all result values from all results
      const allResultValues: ResultValue[] = results.flatMap(result => 
        result.result_values?.map(rv => ({
          id: rv.id,
          analyte_id: rv.analyte_id,
          analyte_name: rv.analyte_name,
          value: rv.value,
          unit: rv.unit,
          reference_range: rv.reference_range,
          flag: rv.flag
        })) || []
      );
      
      // Get AI suggestions for all at once
      const suggestions = await generateResultValueSuggestions(
        allResultValues,
        {
          age: patient.age,
          gender: patient.gender
        }
      );
      
      // Save all suggestions
      const saveResult = await saveResultValueSuggestions(suggestions);
      
      // Reload results to show AI suggestions
      await reloadResults();
      
      alert(`AI Analysis Complete: ${saveResult.success} analyzed, ${saveResult.failed} failed`);
      
    } catch (error) {
      console.error('Batch AI analysis failed:', error);
    }
  };
  
  return (
    <div>
      <button 
        onClick={handleBatchAIAnalysis}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? 'Analyzing...' : `Analyze All Results (${results.length})`}
      </button>
    </div>
  );
};
```

### 5. Fetch Historical Data for Trend Analysis
```typescript
const fetchHistoricalResultValues = async (
  patientId: string,
  analyteIds: string[],
  daysBack: number = 365
) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  const { data, error } = await database.supabase
    .from('result_values')
    .select(`
      id,
      analyte_id,
      analyte_name,
      value,
      unit,
      flag,
      created_at,
      results!inner(
        order_id,
        orders!inner(
          patient_id,
          order_date
        )
      )
    `)
    .eq('results.orders.patient_id', patientId)
    .in('analyte_id', analyteIds)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  
  // Group by analyte
  const grouped = new Map<string, any[]>();
  data?.forEach(rv => {
    if (!grouped.has(rv.analyte_id)) {
      grouped.set(rv.analyte_id, []);
    }
    grouped.get(rv.analyte_id)!.push({
      date: rv.results.orders.order_date,
      value: rv.value,
      flag: rv.flag
    });
  });
  
  return grouped;
};

// Usage
const analyzeWithHistory = async () => {
  const analyteIds = currentResults.map(rv => rv.analyte_id);
  const historicalData = await fetchHistoricalResultValues(patientId, analyteIds);
  
  const enrichedResults = currentResults.map(rv => ({
    ...rv,
    historical_values: historicalData.get(rv.analyte_id) || []
  }));
  
  const suggestions = await generateResultValueSuggestions(enrichedResults, patient);
  // Now suggestions will include trend_interpretation
};
```

## API Response Format

### Input (to Netlify function)
```json
{
  "action": "analyze_result_values",
  "result_values": [
    {
      "id": "uuid-123",
      "analyte_name": "C-Reactive Protein (CRP)",
      "value": "12.5",
      "unit": "mg/L",
      "reference_range": "0-3 mg/L",
      "flag": null,
      "historical_values": [
        {"date": "2025-10-15", "value": "8.2", "flag": "H"},
        {"date": "2025-09-20", "value": "5.1", "flag": "H"}
      ]
    }
  ],
  "patient": {
    "age": 45,
    "gender": "Male"
  }
}
```

### Output (from Netlify function)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "analyte_name": "C-Reactive Protein (CRP)",
      "ai_suggested_flag": "H",
      "ai_suggested_interpretation": "Elevated CRP levels indicate the presence of an acute inflammatory process. This may be due to infection, tissue injury, autoimmune disorders, or other inflammatory conditions.",
      "trend_interpretation": "CRP levels are increasing over time (5.1 → 8.2 → 12.5 mg/L), suggesting worsening inflammation. Close monitoring and investigation of underlying cause is warranted."
    }
  ]
}
```

## Database Schema

### result_values Table (Updated)
```sql
-- AI suggestion fields
ai_suggested_flag TEXT                    -- 'L', 'H', 'C', or 'N'
ai_suggested_interpretation TEXT          -- Clinical interpretation of value
trend_interpretation TEXT                 -- Trend analysis (NEW - not in migration yet)

-- Final approved values (set by verifier)
flag TEXT                                 -- Final approved flag
interpretation TEXT                       -- Final approved interpretation

-- Override tracking
flag_override_by UUID                     -- Who changed the AI flag
flag_override_at TIMESTAMPTZ             -- When flag was changed
interpretation_override_by UUID           -- Who edited the AI interpretation
interpretation_override_at TIMESTAMPTZ    -- When interpretation was edited
verifier_notes TEXT                       -- Verifier's notes
```

## Migration Update Needed

Add `trend_interpretation` field to the migration:

```sql
ALTER TABLE result_values
ADD COLUMN IF NOT EXISTS trend_interpretation TEXT;

COMMENT ON COLUMN result_values.trend_interpretation IS 'AI-generated trend analysis based on historical values';
```

## Benefits

✅ **No master data pollution**: AI suggestions stay in result_values, not lab_analytes
✅ **Per-result intelligence**: Each result value gets personalized AI analysis
✅ **Trend awareness**: AI can analyze value changes over time
✅ **Verifier control**: Suggestions can be accepted, modified, or rejected
✅ **Full audit trail**: Track who overrode AI suggestions and why
✅ **Flexible workflow**: Works with or without historical data

## Next Steps

1. ✅ Updated AI hooks and Netlify function
2. ⚠️ Add `trend_interpretation` column to migration
3. ⚠️ Integrate into ResultVerificationConsole.tsx
4. ⚠️ Add historical data fetching utility
5. ⚠️ Create AI suggestion display components
6. ⚠️ Test with real lab data
