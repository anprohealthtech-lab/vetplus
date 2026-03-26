import { supabase } from './supabase';

export interface AIPromptMatch {
  id: string;
  prompt: string;
  specificity: number; // Higher = more specific match
  source: 'exact' | 'test_lab' | 'test_only' | 'lab_only' | 'default';
}

export type AIProcessingType = 'ocr' | 'color_card' | 'document_analysis' | 'test_suggestion' | 'analyte_suggestion';

/**
 * Resolves the best AI prompt for a given context using the database function
 * with intelligent fallback hierarchy
 */
export async function resolveAIPrompt(
  processingType: AIProcessingType,
  testId?: string,
  analyteId?: string,
  labId?: string
): Promise<AIPromptMatch | null> {
  try {
    const { data, error } = await supabase.rpc('resolve_ai_prompt', {
      p_processing_type: processingType,
      p_test_id: testId || null,
      p_analyte_id: analyteId || null,
      p_lab_id: labId || null
    });

    if (error) {
      console.error('Error resolving AI prompt:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn(`No AI prompt found for processing type: ${processingType}`);
      return null;
    }

    // The function returns the best match first
    const result = data[0];
    return {
      id: result.id,
      prompt: result.prompt,
      specificity: result.specificity,
      source: result.source as AIPromptMatch['source']
    };

  } catch (error) {
    console.error('Unexpected error in resolveAIPrompt:', error);
    return null;
  }
}

/**
 * Helper function to get a prompt with automatic fallback to a system default
 */
export async function getAIPromptWithFallback(
  processingType: AIProcessingType,
  systemDefault: string,
  testId?: string,
  analyteId?: string,
  labId?: string
): Promise<{ prompt: string; source: AIPromptMatch['source'] | 'system_default' }> {
  const resolved = await resolveAIPrompt(processingType, testId, analyteId, labId);
  
  if (resolved) {
    return {
      prompt: resolved.prompt,
      source: resolved.source
    };
  }

  return {
    prompt: systemDefault,
    source: 'system_default'
  };
}

/**
 * Create or update an AI prompt override
 */
export async function upsertAIPrompt(
  processingType: AIProcessingType,
  prompt: string,
  options: {
    testId?: string;
    analyteId?: string;
    labId?: string;
    isDefault?: boolean;
  } = {}
): Promise<{ data: any; error: any }> {
  const { testId, analyteId, labId, isDefault = false } = options;

  // Check if a prompt already exists with this combination
  const { data: existing } = await supabase
    .from('ai_prompts')
    .select('id')
    .eq('ai_processing_type', processingType)
    .eq('test_id', testId || null)
    .eq('analyte_id', analyteId || null)
    .eq('lab_id', labId || null)
    .eq('default', isDefault)
    .maybeSingle();

  const promptData = {
    ai_processing_type: processingType,
    prompt,
    test_id: testId || null,
    analyte_id: analyteId || null,
    lab_id: labId || null,
    default: isDefault
  };

  if (existing) {
    // Update existing prompt
    return await supabase
      .from('ai_prompts')
      .update(promptData)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    // Insert new prompt
    return await supabase
      .from('ai_prompts')
      .insert(promptData)
      .select()
      .single();
  }
}

/**
 * Get all available prompts for a processing type (for management UI)
 */
export async function getAIPrompts(
  processingType?: AIProcessingType,
  labId?: string
): Promise<{ data: any[]; error: any }> {
  let query = supabase
    .from('ai_prompts')
    .select(`
      id,
      ai_processing_type,
      prompt,
      test_id,
      analyte_id,
      lab_id,
      "default",
      created_at,
      test_groups!ai_prompts_test_id_fkey (name),
      analytes!ai_prompts_analyte_id_fkey (name),
      labs!ai_prompts_lab_id_fkey (name)
    `)
    .order('created_at', { ascending: false });

  if (processingType) {
    query = query.eq('ai_processing_type', processingType);
  }

  if (labId) {
    query = query.or(`lab_id.eq.${labId},lab_id.is.null`);
  }

  return await query;
}

/**
 * Delete an AI prompt
 */
export async function deleteAIPrompt(promptId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('ai_prompts')
    .delete()
    .eq('id', promptId);

  return { error };
}
