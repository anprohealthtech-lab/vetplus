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
  
  console.log('Invoking AI (Anthropic) for TestGroup:', testGroupId);

  const { data, error } = await supabase.functions.invoke('resolve-reference-ranges', {
    body: { orderId, testGroupId, analytes }
  });

  if (error) {
    console.error('Error resolving reference ranges:', error);
    // Silent fail: return analytes as is
    return analytes.map(a => ({ ...a }));
  }

  if (!data?.success) {
      console.error('AI Function returned failure:', data?.error);
      return analytes.map(a => ({ ...a }));
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
