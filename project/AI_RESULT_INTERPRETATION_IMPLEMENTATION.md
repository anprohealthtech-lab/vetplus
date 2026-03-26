# AI Result Interpretation & Trend Graphs Implementation

## Overview
This system allows AI to suggest flags and interpretations for individual result values WITHOUT modifying master analyte data. Verifiers can review, edit, or override AI suggestions. Additionally, reports can include trend graphs and AI-generated doctor summaries.

## Database Schema Changes

### 1. `result_values` Table - AI Fields
```sql
-- AI suggestions (populated by AI)
ai_suggested_flag TEXT                    -- AI's flag suggestion (L/H/C/N)
ai_suggested_interpretation TEXT          -- AI's clinical interpretation
verifier_notes TEXT                       -- Verifier comments about this result

-- Override tracking (populated when verifier edits)
flag_override_by UUID                     -- User who changed the flag
flag_override_at TIMESTAMPTZ             -- When flag was changed
interpretation_override_by UUID           -- User who edited interpretation
interpretation_override_at TIMESTAMPTZ    -- When interpretation was edited
```

### 2. `orders` Table - Trend Data
```sql
trend_graph_data JSONB                    -- Historical trend data for analytes
trend_graph_generated_at TIMESTAMPTZ     -- When trend was generated
trend_graph_generated_by UUID            -- User/system that generated it
```

### 3. `reports` Table - AI Summary & Trends
```sql
ai_doctor_summary TEXT                    -- AI-generated clinical summary
ai_summary_generated_at TIMESTAMPTZ      -- When summary was generated
ai_summary_reviewed_by UUID              -- Who reviewed the summary
ai_summary_reviewed_at TIMESTAMPTZ       -- When summary was reviewed
include_trend_graphs BOOLEAN             -- Whether to include trends in PDF
trend_graphs_config JSONB                -- Which analytes to show trends for
```

## Workflow

### 1. AI Result Processing (Result Entry)
```typescript
// When AI processes a result attachment or workflow submission
const aiProcessing = async (resultId: string, resultValues: ResultValue[]) => {
  for (const rv of resultValues) {
    // AI analyzes the result value
    const aiAnalysis = await analyzeResultValue({
      analyte_name: rv.analyte_name,
      value: rv.value,
      reference_range: rv.reference_range,
      patient_age: patientAge,
      patient_gender: patientGender
    });
    
    // Save AI suggestions (don't override existing values)
    await supabase
      .from('result_values')
      .update({
        ai_suggested_flag: aiAnalysis.flag,
        ai_suggested_interpretation: aiAnalysis.interpretation
      })
      .eq('id', rv.id);
  }
};
```

### 2. Verifier Review UI
```typescript
// Component: ResultValueReviewCard.tsx
const ResultValueReviewCard = ({ resultValue }: { resultValue: ResultValue }) => {
  const [flag, setFlag] = useState(resultValue.flag || resultValue.ai_suggested_flag);
  const [interpretation, setInterpretation] = useState(
    resultValue.interpretation || resultValue.ai_suggested_interpretation
  );
  const [notes, setNotes] = useState(resultValue.verifier_notes || '');
  
  const hasAISuggestion = resultValue.ai_suggested_flag || resultValue.ai_suggested_interpretation;
  const isModified = 
    flag !== resultValue.ai_suggested_flag || 
    interpretation !== resultValue.ai_suggested_interpretation;
  
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold">{resultValue.analyte_name}</h4>
          <p className="text-2xl font-bold">{resultValue.value} {resultValue.unit}</p>
          <p className="text-sm text-gray-600">Ref: {resultValue.reference_range}</p>
        </div>
        
        {/* Flag selector */}
        <select 
          value={flag} 
          onChange={(e) => setFlag(e.target.value)}
          className={hasAISuggestion && isModified ? 'border-yellow-500' : ''}
        >
          <option value="">Normal</option>
          <option value="L">Low</option>
          <option value="H">High</option>
          <option value="C">Critical</option>
        </select>
      </div>
      
      {/* AI Suggestion Badge */}
      {hasAISuggestion && (
        <div className="mt-2 p-2 bg-blue-50 rounded">
          <p className="text-xs font-semibold text-blue-700">AI Suggestion</p>
          <p className="text-sm">Flag: {resultValue.ai_suggested_flag || 'None'}</p>
          {resultValue.ai_suggested_interpretation && (
            <p className="text-sm mt-1">{resultValue.ai_suggested_interpretation}</p>
          )}
        </div>
      )}
      
      {/* Interpretation editor */}
      <textarea
        value={interpretation}
        onChange={(e) => setInterpretation(e.target.value)}
        placeholder="Add clinical interpretation..."
        className="w-full mt-2 p-2 border rounded"
      />
      
      {/* Verifier notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add verifier notes..."
        className="w-full mt-2 p-2 border rounded text-sm"
      />
      
      <button
        onClick={() => applyChanges(resultValue.id, flag, interpretation, notes)}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {isModified ? 'Override AI' : 'Apply'} Suggestion
      </button>
    </div>
  );
};
```

### 3. Apply AI Suggestions Function
```typescript
const applyChanges = async (
  resultValueId: string,
  flag: string,
  interpretation: string,
  notes: string
) => {
  const user_id = await database.getCurrentUserId();
  
  // Call RPC function to apply with override tracking
  const { data, error } = await supabase.rpc('apply_ai_suggestions_to_result_value', {
    p_result_value_id: resultValueId,
    p_user_id: user_id,
    p_custom_flag: flag,
    p_custom_interpretation: interpretation
  });
  
  // Update verifier notes separately
  await supabase
    .from('result_values')
    .update({ verifier_notes: notes })
    .eq('id', resultValueId);
    
  if (error) throw error;
  return data;
};
```

### 4. Trend Graph Generation
```typescript
// Generate historical trend data for an order
const generateTrendGraphData = async (orderId: string, patientId: string) => {
  const user_id = await database.getCurrentUserId();
  
  // Get all result values for this patient over last 12 months
  const { data: historicalResults } = await supabase
    .from('result_values')
    .select(`
      analyte_id,
      analyte_name,
      value,
      unit,
      reference_range,
      flag,
      created_at,
      results!inner(order_id, orders!inner(sample_id, order_date))
    `)
    .eq('results.orders.patient_id', patientId)
    .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });
  
  // Group by analyte
  const analyteMap = new Map<string, TrendAnalyteData>();
  
  historicalResults?.forEach((rv: any) => {
    if (!analyteMap.has(rv.analyte_id)) {
      analyteMap.set(rv.analyte_id, {
        analyte_id: rv.analyte_id,
        analyte_name: rv.analyte_name,
        unit: rv.unit,
        reference_range: rv.reference_range,
        data_points: []
      });
    }
    
    analyteMap.get(rv.analyte_id)!.data_points.push({
      date: rv.results.orders.order_date,
      value: parseFloat(rv.value),
      flag: rv.flag,
      order_id: rv.results.order_id,
      sample_id: rv.results.orders.sample_id
    });
  });
  
  const trendData: TrendGraphData = {
    analytes: Array.from(analyteMap.values()),
    patient_id: patientId,
    generated_at: new Date().toISOString()
  };
  
  // Save to orders table
  await supabase.rpc('save_trend_graph_data', {
    p_order_id: orderId,
    p_trend_data: trendData,
    p_user_id: user_id
  });
  
  return trendData;
};
```

### 5. AI Doctor Summary Generation
```typescript
// Generate AI-powered clinical summary for doctors
const generateAIDoctorSummary = async (orderId: string) => {
  const user_id = await database.getCurrentUserId();
  
  // Get all result values for this order
  const { data: results } = await supabase
    .from('results')
    .select(`
      *,
      result_values(*)
    `)
    .eq('order_id', orderId);
  
  // Call AI to generate summary
  const summary = await callGeminiAPI({
    test_groups: results.map(r => ({
      name: r.test_name,
      result_values: r.result_values
    })),
    patient: patientInfo,
    request_type: 'doctor_summary'
  });
  
  // Save to reports table
  await supabase.rpc('generate_ai_doctor_summary', {
    p_order_id: orderId,
    p_summary_text: summary,
    p_user_id: user_id
  });
  
  return summary;
};
```

### 6. PDF Report with Trends & AI Summary
```typescript
// Modify pdfService.ts to include trend graphs and AI summary
const buildReportContext = async (order: Order, results: Result[]) => {
  const context = {
    ...existingContext,
    
    // Add trend graphs if enabled
    trend_graphs: order.trend_graph_data ? 
      generateTrendGraphHTML(order.trend_graph_data) : null,
    
    // Add AI doctor summary from reports table
    ai_summary: await getAIDoctorSummary(order.id),
    
    // Add AI interpretations from result_values
    results: results.map(r => ({
      ...r,
      result_values: r.result_values?.map((rv: ResultValue) => ({
        ...rv,
        has_ai_interpretation: !!rv.ai_suggested_interpretation,
        interpretation: rv.interpretation || rv.ai_suggested_interpretation,
        flag_was_overridden: !!rv.flag_override_by
      }))
    }))
  };
  
  return context;
};

const generateTrendGraphHTML = (trendData: TrendGraphData) => {
  // Use Chart.js or similar to generate trend graph images
  // Or use SVG for inline rendering in PDF
  return `
    <div class="trend-graphs">
      <h3>Historical Trends</h3>
      ${trendData.analytes.map(analyte => `
        <div class="trend-chart">
          <h4>${analyte.analyte_name}</h4>
          <svg width="600" height="200">
            <!-- Draw line chart with data points -->
            ${analyte.data_points.map((dp, i) => 
              generateDataPointSVG(dp, i, analyte.data_points.length)
            ).join('')}
          </svg>
        </div>
      `).join('')}
    </div>
  `;
};
```

## UI Components to Create

### 1. `AIResultReviewPanel.tsx`
- Shows result values with AI suggestions side-by-side
- Allows verifier to accept, edit, or override
- Tracks which fields were manually changed
- Shows badge when AI suggestion differs from final value

### 2. `TrendGraphViewer.tsx`
- Displays historical trend charts for selected analytes
- Allows selection of date range
- Shows flags and reference ranges
- Can be toggled on/off in report configuration

### 3. `AIDoctorSummaryEditor.tsx`
- Shows AI-generated clinical summary
- Allows lab manager to review and edit before finalizing
- Tracks who reviewed and when
- Can be regenerated if needed

### 4. `ReportConfigPanel.tsx`
- Checkbox: "Include Trend Graphs"
- Multi-select: Which analytes to show trends for
- Checkbox: "Include AI Doctor Summary"
- Preview button to see how it will look in PDF

## API Integration Points

### Gemini AI - Result Intelligence
```typescript
// Modified ai-result-intelligence.ts function
export const analyzeResultValue = async (params: {
  analyte_name: string;
  value: string;
  reference_range: string;
  patient_age: number;
  patient_gender: string;
}) => {
  const prompt = `
Analyze this lab result value and provide:
1. Flag (L/H/C/N)
2. Clinical interpretation (1-2 sentences)

Analyte: ${params.analyte_name}
Value: ${params.value}
Reference Range: ${params.reference_range}
Patient: ${params.patient_age}y ${params.patient_gender}

Respond in JSON:
{
  "flag": "L|H|C|N",
  "interpretation": "brief clinical interpretation"
}
  `;
  
  const response = await callGeminiAPI(prompt);
  return JSON.parse(response);
};
```

## Migration Deployment Steps

1. **Run SQL migration**:
   ```bash
   # Copy contents of 20250127_add_ai_fields_result_values_reports.sql
   # Paste into Supabase SQL Editor and execute
   ```

2. **Update TypeScript types**:
   - ✅ Already added to `src/types/index.ts`

3. **Create UI components**:
   - `src/components/Results/AIResultReviewPanel.tsx`
   - `src/components/Results/TrendGraphViewer.tsx`
   - `src/components/Reports/AIDoctorSummaryEditor.tsx`
   - `src/components/Reports/ReportConfigPanel.tsx`

4. **Integrate into existing pages**:
   - `ResultVerificationConsole.tsx` - Add AI review panel
   - `Reports.tsx` - Add trend graph and AI summary options
   - `OrderDetailsModal.tsx` - Show AI suggestions during result entry

5. **Update PDF generation**:
   - Modify `pdfService.ts` to include trend graphs (SVG/Canvas)
   - Add AI summary section to report template
   - Add flag override indicators

## Benefits

✅ **No master data pollution**: AI suggestions stay in result_values, not analytes
✅ **Full audit trail**: Track who overrode AI suggestions and when
✅ **Verifier empowerment**: Verifiers can accept, edit, or override AI
✅ **Historical insights**: Trend graphs show patient progression
✅ **Doctor convenience**: AI summary provides quick overview
✅ **Flexible reporting**: Enable/disable trends and AI summary per report

## Next Steps

1. ✅ Database migration created
2. ✅ TypeScript types added
3. ⚠️ Need to run migration in Supabase
4. ⚠️ Need to create UI components
5. ⚠️ Need to integrate AI API calls
6. ⚠️ Need to update PDF templates
