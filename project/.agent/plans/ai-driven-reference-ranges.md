# AI-Driven Dynamic Reference Ranges - Simplified Approach

## Concept Overview

Instead of managing complex rule tables, use **AI to dynamically determine reference ranges** based on:
1. Patient demographics (age, gender) from order
2. Patient conditions (pregnancy, lactation, etc.) from order metadata
3. Test group configuration (can override default behavior)

---

## Architecture

### 1. Data Storage (Minimal Schema Changes)

#### 1.0 Patient Schema - Age Units Support
To accurately support pediatric ranges when DOB is unknown, we need explicit age units.

```sql
-- Migration: Add age_unit to patients
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS age_unit text DEFAULT 'years' CHECK (age_unit IN ('years', 'months', 'days'));
```

#### 1.1 Test Groups - Add AI Config & Input Requirements
```sql
-- Migration: Add AI reference range configuration
ALTER TABLE test_groups
ADD COLUMN IF NOT EXISTS ref_range_ai_config jsonb DEFAULT '{}'::jsonb;

-- Migration: Add Required Inputs (to identify special needs like "LMP")
ALTER TABLE test_groups
ADD COLUMN IF NOT EXISTS required_patient_inputs jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN test_groups.required_patient_inputs IS '["pregnancy_status", "lmp", "weight"]';
```

#### 1.2 Orders - Store Patient Context
```sql
-- Migration: Add patient context snapshot to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS patient_context jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN orders.patient_context IS 
'Patient context at time of order for reference range determination. Example:
{
  "age": 28,
  "age_unit": "years",
  "age_in_days": 10220,
  "gender": "Female",
  "conditions": ["pregnant"],
  "pregnancy": { ... }
}';

-- Add index for quick access
CREATE INDEX idx_orders_patient_context ON orders USING gin(patient_context);
```

#### 1.3 Analytes - Store AI Knowledge Base
```sql
-- Migration: Add reference range knowledge base to analytes
ALTER TABLE analytes
ADD COLUMN IF NOT EXISTS ref_range_knowledge jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN analytes.ref_range_knowledge IS 
'Medical knowledge about reference ranges for different populations. Example:
{
  "standard": {
    "adult_male": {"ref_low": 13.5, "ref_high": 17.5, "unit": "g/dL"},
    "adult_female": {"ref_low": 12.0, "ref_high": 15.5, "unit": "g/dL"}
  },
  "age_based": {
    "newborn_0_1m": {"ref_low": 14.0, "ref_high": 24.0},
    "infant_1_6m": {"ref_low": 10.0, "ref_high": 17.0},
    "child_1_12y": {"ref_low": 11.0, "ref_high": 16.0}
  },
  "condition_based": {
    "pregnant_t1": {"ref_low": 11.0, "ref_high": 14.0},
    "pregnant_t2": {"ref_low": 10.5, "ref_high": 14.0},
    "pregnant_t3": {"ref_low": 10.0, "ref_high": 14.0},
    "lactating": {"ref_low": 12.0, "ref_high": 15.0}
  },
  "clinical_notes": "Hemoglobin levels naturally decrease during pregnancy due to plasma volume expansion"
}';
```

---

## 2. AI Edge Function: Dynamic Reference Range Resolver

### 2.1 Edge Function Implementation
```typescript
// File: supabase/functions/resolve-reference-ranges/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ResolveRequest {
  orderId: string;
  testGroupId: string;
  analytes: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
  }>;
}

interface ReferenceRangeResult {
  analyte_id: string;
  analyte_name: string;
  ref_low: number | null;
  ref_high: number | null;
  critical_low: number | null;
  critical_high: number | null;
  flag: 'N' | 'L' | 'H' | 'LL' | 'HH' | null;
  applied_rule: string;
  reasoning: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, testGroupId, analytes }: ResolveRequest = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch order with patient context
    const { data: order } = await supabase
      .from('orders')
      .select('patient_context, patient_id')
      .eq('id', orderId)
      .single()

    // 2. Fetch test group AI config
    const { data: testGroup } = await supabase
      .from('test_groups')
      .select('ref_range_ai_config')
      .eq('id', testGroupId)
      .single()

    // 3. Fetch analyte knowledge bases
    const analyteIds = analytes.map(a => a.id)
    const { data: analyteData } = await supabase
      .from('analytes')
      .select('id, name, ref_range_knowledge, reference_range, unit')
      .in('id', analyteIds)

    // 4. Build AI prompt
    const prompt = buildReferenceRangePrompt(
      order.patient_context,
      testGroup.ref_range_ai_config,
      analyteData,
      analytes
    )

    // 5. Call Gemini AI
    const geminiKey = Deno.env.get('ALLGOOGLE_KEY')
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,  // Low temperature for consistent medical decisions
            responseMimeType: "application/json"
          }
        })
      }
    )

    const aiData = await aiResponse.json()
    const results: ReferenceRangeResult[] = JSON.parse(
      aiData.candidates[0].content.parts[0].text
    )

    // 6. Log AI decision for audit
    await supabase.from('ai_usage_logs').insert({
      processing_type: 'reference_range_resolution',
      input_data: { orderId, testGroupId, patient_context: order.patient_context },
      confidence: results[0]?.confidence || 0,
      created_at: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildReferenceRangePrompt(
  patientContext: any,
  testGroupConfig: any,
  analyteKnowledge: any[],
  analyteValues: any[]
): string {
  return `You are a clinical laboratory AI assistant. Determine appropriate reference ranges and flags for the following test results.

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

TEST GROUP CONFIGURATION:
${JSON.stringify(testGroupConfig, null, 2)}

ANALYTE KNOWLEDGE BASE:
${analyteKnowledge.map(a => `
${a.name}:
- Default Range: ${a.reference_range}
- Unit: ${a.unit}
- Knowledge: ${JSON.stringify(a.ref_range_knowledge, null, 2)}
`).join('\n')}

TEST RESULTS TO EVALUATE:
${analyteValues.map(a => `
- ${a.name}: ${a.value} ${a.unit}
`).join('\n')}

INSTRUCTIONS:
1. For each analyte, determine the most appropriate reference range based on:
   - Patient age (consider pediatric, adult, geriatric ranges)
   - Patient gender (if applicable)
   - Patient conditions (pregnancy, lactation, chronic diseases)
   - Test group specific overrides (if any)

2. Apply flags:
   - N (Normal): Within reference range
   - L (Low): Below reference range but above critical
   - H (High): Above reference range but below critical
   - LL (Critical Low): Below critical low threshold
   - HH (Critical High): Above critical high threshold

3. For pregnant patients:
   - Use trimester-specific ranges when available
   - Consider physiological changes during pregnancy

4. For pediatric patients:
   - Use age-specific ranges (newborn, infant, child)
   - Consider developmental stage

5. Provide reasoning for each decision

Return JSON array with this structure:
[{
  "analyte_id": "uuid",
  "analyte_name": "string",
  "ref_low": number | null,
  "ref_high": number | null,
  "critical_low": number | null,
  "critical_high": number | null,
  "flag": "N" | "L" | "H" | "LL" | "HH" | null,
  "applied_rule": "string (e.g., 'Pregnant Trimester 2', 'Adult Female', 'Pediatric 5y')",
  "reasoning": "string (brief clinical reasoning)",
  "confidence": number (0-1)
}]`;
}
```

---

## 3. Client-Side Integration

### 3.1 Service Function
```typescript
// File: src/utils/referenceRangeService.ts

import { supabase } from './supabase';

export interface AnalyteWithRange {
  id: string;
  name: string;
  value: string;
  unit: string;
  ref_low?: number;
  ref_high?: number;
  critical_low?: number;
  critical_high?: number;
  flag?: 'N' | 'L' | 'H' | 'LL' | 'HH';
  applied_rule?: string;
  reasoning?: string;
}

export async function resolveReferenceRanges(
  orderId: string,
  testGroupId: string,
  analytes: Array<{ id: string; name: string; value: string; unit: string }>
): Promise<AnalyteWithRange[]> {
  
  const { data, error } = await supabase.functions.invoke('resolve-reference-ranges', {
    body: { orderId, testGroupId, analytes }
  });

  if (error) {
    console.error('Error resolving reference ranges:', error);
    // Fallback to default ranges
    return analytes.map(a => ({ ...a, flag: null }));
  }

  // Merge AI results with analyte data
  return analytes.map(analyte => {
    const aiResult = data.results.find((r: any) => r.analyte_id === analyte.id);
    return {
      ...analyte,
      ...aiResult
    };
  });
}
```

### 3.2 React Component Usage
```typescript
// File: src/components/Results/ResultEntryWithAIRanges.tsx

export const ResultEntryWithAIRanges = ({ orderId, testGroupId }) => {
  const [analytes, setAnalytes] = useState<AnalyteWithRange[]>([]);
  const [loading, setLoading] = useState(false);

  const handleValueChange = async (analyteId: string, value: string) => {
    // Update local state
    setAnalytes(prev => prev.map(a => 
      a.id === analyteId ? { ...a, value } : a
    ));
  };

  const handleResolveRanges = async () => {
    setLoading(true);
    
    const resolved = await resolveReferenceRanges(
      orderId,
      testGroupId,
      analytes
    );
    
    setAnalytes(resolved);
    setLoading(false);
  };

  return (
    <div>
      <button onClick={handleResolveRanges} disabled={loading}>
        {loading ? 'Resolving Ranges...' : 'Apply AI Reference Ranges'}
      </button>

      {analytes.map(analyte => (
        <div key={analyte.id} className="result-row">
          <div>{analyte.name}</div>
          <input 
            value={analyte.value}
            onChange={(e) => handleValueChange(analyte.id, e.target.value)}
          />
          <div>{analyte.unit}</div>
          
          {analyte.ref_low && analyte.ref_high && (
            <div className="ref-range">
              {analyte.ref_low} - {analyte.ref_high}
              <span className="text-xs text-gray-500">
                ({analyte.applied_rule})
              </span>
            </div>
          )}
          
          {analyte.flag && (
            <div className={`flag flag-${analyte.flag}`}>
              {analyte.flag}
            </div>
          )}
          
          {analyte.reasoning && (
            <div className="text-xs text-gray-600">
              {analyte.reasoning}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 3.3 Persisting AI Results
CRITICAL: The resolved `reference_range` from AI must be saved to the database (`result_values` table) so that the **Generated PDF** uses the correct, context-aware range instead of the static default.

```typescript
// Update saveResults logic to include reference_range
const handleSave = async () => {
  const updates = analytes.map(a => ({
    result_id: a.result_id,
    value: a.value,
    flag: a.flag,
    reference_range: `${a.ref_low} - ${a.ref_high}`, // Persist the AI-resolved range!
    ai_metadata: { applied_rule: a.applied_rule, reasoning: a.reasoning }
  }));
  
  await supabase.from('result_values').upsert(updates);
};
```
```

---

  
  return Array.from(requirements); // e.g., ["pregnancy_status", "lmp"]
};

// UI Logic:
// 1. User selects tests.
// 2. Call getRequiredInputs(selectedIds).
// 3. If requirements > 0, show "Additional Information Required" modal.
// 4. Capture inputs (LMP, Conditions, etc.).
```

#### Step 2: Create Order with Context
```typescript
const createOrderWithContext = async (patientId: string, testGroupIds: string[], additionalInputs: any) => {
  // 1. Fetch patient data
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();

  // 2. Normalize Age (Crucial for AI)
  // Logic: Use DOB if available. Else use Age + Age Unit.
  const calculateAgeInDays = (p: any) => {
    if (p.date_of_birth) {
       const dob = new Date(p.date_of_birth);
       const diff = new Date().getTime() - dob.getTime();
       return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    const unit = p.age_unit || 'years';
    if (unit === 'years') return p.age * 365;
    if (unit === 'months') return p.age * 30;
    return p.age; // days
  };

  // 3. Build Rich Context for AI
  const patientContext = {
    age: patient.age,
    age_unit: patient.age_unit || 'years',
    age_in_days: calculateAgeInDays(patient),
    gender: patient.gender,
    conditions: patient.conditions || [],
    pregnancy: additionalInputs.pregnancy_status || patient.pregnancy_status || null,
    lmp: additionalInputs.lmp || null, // Last Menstrual Period
    medications: patient.medications || [],
    bmi: patient.bmi || null
  };

  // 4. Create Order
  const { data: order } = await supabase
    .from('orders')
    .insert({
      patient_id: patientId,
      patient_context: patientContext,
      // ...
    })
    .select()
    .single();

  return order;
};
```
```

### 4.2 Result Entry - Auto-Resolve on Load
```typescript
// When opening result entry, automatically resolve ranges
useEffect(() => {
  if (orderId && testGroupId && analytes.length > 0) {
    resolveReferenceRanges(orderId, testGroupId, analytes)
      .then(setAnalytes);
  }
}, [orderId, testGroupId]);
```

---

## 5. Test Group Configuration UI

### 5.1 Reference Range AI Config Editor
```typescript
// File: src/components/Settings/TestGroupReferenceRangeConfig.tsx

export const TestGroupReferenceRangeConfig = ({ testGroupId }) => {
  const [config, setConfig] = useState({
    enabled: true,
    consider_age: true,
    consider_gender: true,
    consider_conditions: ['pregnant', 'lactating'],
    custom_instructions: '',
    override_analytes: {}
  });

  return (
    <div className="config-editor">
      <h3>AI Reference Range Configuration</h3>
      
      <label>
        <input 
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({...config, enabled: e.target.checked})}
        />
        Enable AI-driven reference ranges
      </label>

      <label>
        <input 
          type="checkbox"
          checked={config.consider_age}
          onChange={(e) => setConfig({...config, consider_age: e.target.checked})}
        />
        Consider patient age
      </label>

      <label>
        <input 
          type="checkbox"
          checked={config.consider_gender}
          onChange={(e) => setConfig({...config, consider_gender: e.target.checked})}
        />
        Consider patient gender
      </label>

      <div>
        <label>Conditions to Consider:</label>
        <MultiSelect
          options={['pregnant', 'lactating', 'diabetic', 'hypertensive']}
          value={config.consider_conditions}
          onChange={(val) => setConfig({...config, consider_conditions: val})}
        />
      </div>

      <div>
        <label>Custom Instructions for AI:</label>
        <textarea
          value={config.custom_instructions}
          onChange={(e) => setConfig({...config, custom_instructions: e.target.value})}
          placeholder="E.g., For pregnant women in 3rd trimester, use lower threshold for anemia..."
        />
      </div>

      <button onClick={() => saveConfig(testGroupId, config)}>
        Save Configuration
      </button>
    </div>
  );
};
```

---

## 6. Benefits of AI-Driven Approach

### Advantages:
1. ✅ **No Complex Rule Tables** - AI handles all logic
2. ✅ **Self-Learning** - Can improve with medical knowledge updates
3. ✅ **Flexible** - Handles any combination of factors
4. ✅ **Explainable** - AI provides reasoning for each decision
5. ✅ **Easy to Override** - Test group level configuration
6. ✅ **Minimal Schema** - Just 3 JSONB columns
7. ✅ **Audit Trail** - All AI decisions logged
8. ✅ **Fast** - Single AI call per test group

### Considerations:
1. ⚠️ **AI Cost** - Each result entry triggers AI call
2. ⚠️ **Latency** - ~1-2 seconds for AI response
3. ⚠️ **Accuracy** - Requires good knowledge base
4. ⚠️ **Fallback** - Need default ranges if AI fails

---

## 7. Optimization Strategies

### 7.1 Caching
```typescript
// Cache AI results for same patient context + test group
const cacheKey = `${orderId}_${testGroupId}_${JSON.stringify(analyteIds)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... call AI ...

await redis.set(cacheKey, JSON.stringify(results), 'EX', 3600); // 1 hour cache
```

### 7.2 Batch Processing
```typescript
// Resolve all test groups in an order at once
const resolveAllTestGroupsInOrder = async (orderId: string) => {
  const { data: orderTests } = await supabase
    .from('order_tests')
    .select('test_group_id, analytes')
    .eq('order_id', orderId);

  // Single AI call for all test groups
  const allResults = await supabase.functions.invoke('resolve-reference-ranges', {
    body: { orderId, testGroups: orderTests }
  });

  return allResults;
};
```

---

## 8. Migration Path

### Phase 1: Add Columns (Week 1)
```sql
ALTER TABLE test_groups ADD COLUMN ref_range_ai_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN patient_context jsonb DEFAULT '{}'::jsonb;
ALTER TABLE analytes ADD COLUMN ref_range_knowledge jsonb DEFAULT '{}'::jsonb;
```

### Phase 2: Create Edge Function (Week 1)
- Build `resolve-reference-ranges` Edge Function
- Test with sample data
- Deploy to production

### Phase 3: Populate Knowledge Base (Week 2)
- Add reference range knowledge to common analytes
- Use AI to generate knowledge from medical literature
- Review and validate

### Phase 4: UI Integration (Week 2-3)
- Add patient context capture to order creation
- Integrate AI resolution into result entry
- Add test group configuration UI

### Phase 5: Testing & Rollout (Week 3-4)
- Test with real patient scenarios
- Compare AI decisions with manual decisions
- Gradual rollout to labs

---

## 9. Example Scenarios

### Scenario 1: Pregnant Woman
```json
{
  "patient_context": {
    "age": 28,
    "gender": "Female",
    "conditions": ["pregnant"],
    "pregnancy": {"trimester": 2, "weeks": 20}
  },
  "analyte": "Hemoglobin",
  "value": "11.5",
  "unit": "g/dL"
}

AI Response:
{
  "ref_low": 10.5,
  "ref_high": 14.0,
  "flag": "N",
  "applied_rule": "Pregnant Trimester 2",
  "reasoning": "During 2nd trimester, hemoglobin naturally decreases due to plasma volume expansion. 11.5 g/dL is within expected range.",
  "confidence": 0.95
}
```

### Scenario 2: Pediatric Patient
```json
{
  "patient_context": {
    "age": 5,
    "age_in_months": 60,
    "gender": "Male",
    "conditions": []
  },
  "analyte": "Hemoglobin",
  "value": "12.0",
  "unit": "g/dL"
}

AI Response:
{
  "ref_low": 11.0,
  "ref_high": 16.0,
  "flag": "N",
  "applied_rule": "Pediatric 5 years",
  "reasoning": "For children aged 1-12 years, hemoglobin reference range is 11.0-16.0 g/dL. Value is normal.",
  "confidence": 0.98
}
```

---

## Summary

This AI-driven approach is **simpler, more flexible, and easier to maintain** than traditional rule-based systems. It leverages your existing infrastructure and adds minimal schema changes while providing intelligent, context-aware reference range determination.

**Ready to implement?** 🚀
