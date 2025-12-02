/**
 * useAIResultIntelligence Hook
 * 
 * Provides AI-powered clinical intelligence utilities for laboratory results:
 * 1. Generate missing interpretations for analytes
 * 2. Generate verifier summary for test groups
 * 3. Generate clinical summary for referring doctors
 */

import { useState, useCallback } from 'react';
import { database } from '../utils/supabase';

// Types matching the Netlify function
export interface AnalyteData {
  id: string;
  name: string;
  unit: string;
  reference_range: string;
  interpretation_low?: string | null;
  interpretation_normal?: string | null;
  interpretation_high?: string | null;
}

export interface ResultValue {
  id?: string; // result_value ID for updating
  analyte_id?: string;
  analyte_name: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: 'H' | 'L' | 'C' | null;
  interpretation?: string | null;
  ai_suggested_flag?: string | null;
  ai_suggested_interpretation?: string | null;
  trend_interpretation?: string | null;
}

export interface TestGroupContext {
  test_group_name: string;
  test_group_code: string;
  category?: string;
  clinical_purpose?: string;
}

export interface PatientContext {
  age?: number;
  gender?: string;
  clinical_notes?: string;
}

// Response types
export interface GeneratedInterpretation {
  analyte_id: string;
  analyte_name: string;
  interpretation_low: string;
  interpretation_normal: string;
  interpretation_high: string;
}

export interface InterpretationsResponse {
  interpretations: GeneratedInterpretation[];
}

export interface VerifierSummaryResponse {
  overall_assessment: string;
  abnormal_findings: string[];
  critical_alerts: string[];
  recommendation: 'approve' | 'needs_clarification' | 'reject';
  recommendation_reason: string;
  verifier_notes?: string;
}

export interface SignificantFinding {
  finding: string;
  clinical_significance: string;
  test_group: string;
}

export interface ClinicalSummaryResponse {
  executive_summary: string;
  significant_findings: SignificantFinding[];
  suggested_followup: string[];
  urgent_findings: string[];
  clinical_interpretation: string;
  overall_impression?: string;
  // Flags for saved summaries loaded from database
  _savedFromDb?: boolean;
  _generatedAt?: string;
}

interface AIResultIntelligenceState {
  loading: boolean;
  error: string | null;
}

const NETLIFY_FUNCTION_URL = '/.netlify/functions/ai-result-intelligence';

/**
 * Hook for AI-powered result intelligence
 */
export function useAIResultIntelligence() {
  const [state, setState] = useState<AIResultIntelligenceState>({
    loading: false,
    error: null,
  });

  /**
   * Make API call to the Netlify function
   */
  const callAIFunction = useCallback(async <T>(body: object): Promise<T> => {
    setState({ loading: true, error: null });
    
    try {
      const response = await fetch(NETLIFY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'AI request failed');
      }

      setState({ loading: false, error: null });
      return result.data as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState({ loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  /**
   * Generate missing interpretations for analytes
   * Call at TEST GROUP level
   */
  const generateMissingInterpretations = useCallback(async (
    analytes: AnalyteData[],
    testGroup: TestGroupContext
  ): Promise<InterpretationsResponse> => {
    // Filter to only analytes missing interpretations
    const analytesNeedingInterpretations = analytes.filter(a => 
      !a.interpretation_low || 
      !a.interpretation_normal || 
      !a.interpretation_high
    );

    if (analytesNeedingInterpretations.length === 0) {
      return { interpretations: [] };
    }

    return callAIFunction<InterpretationsResponse>({
      action: 'generate_interpretations',
      analytes: analytesNeedingInterpretations,
      test_group: testGroup,
    });
  }, [callAIFunction]);

  /**
   * Generate AI suggestions for result values (flag, interpretation, trend)
   * Saves to result_values.ai_suggested_flag, ai_suggested_interpretation
   * @param resultValues - Array of result values to analyze
   * @param patient - Patient context for personalized interpretation
   * @param trendData - Optional historical trend data
   */
  const generateResultValueSuggestions = useCallback(async (
    resultValues: ResultValue[],
    patient?: PatientContext,
    trendData?: any
  ): Promise<ResultValue[]> => {
    const aiResponse = await callAIFunction<ResultValue[]>({
      action: 'analyze_result_values',
      result_values: resultValues,
      patient,
      trend_data: trendData,
    });

    // Merge AI response with original input to preserve IDs
    // Match by analyte_name since AI may not return the original ID
    return aiResponse.map((aiSuggestion) => {
      const original = resultValues.find(
        rv => rv.analyte_name === aiSuggestion.analyte_name
      );
      return {
        ...aiSuggestion,
        // Preserve the original result_value ID for database update
        id: original?.id || aiSuggestion.id,
        analyte_id: original?.analyte_id || aiSuggestion.analyte_id,
        // Keep original values that may not be in AI response
        value: original?.value || aiSuggestion.value || '',
        unit: original?.unit || aiSuggestion.unit || '',
        reference_range: original?.reference_range || aiSuggestion.reference_range || '',
      };
    });
  }, [callAIFunction]);

  /**
   * Save AI suggestions to result_values table
   * Updates BOTH the ai_suggested fields AND the actual flag field
   * @param suggestions - AI-generated suggestions with result_value IDs
   * @param applyToActualFlag - If true, also updates the actual 'flag' column (default: true)
   */
  const saveResultValueSuggestions = useCallback(async (
    suggestions: ResultValue[],
    applyToActualFlag: boolean = true
  ): Promise<{ success: number; failed: number }> => {
    setState({ loading: true, error: null });
    
    try {
      let successCount = 0;
      let failedCount = 0;

      for (const suggestion of suggestions) {
        if (!suggestion.id) {
          failedCount++;
          continue;
        }

        // Build update object
        const updateData: Record<string, any> = {
          ai_suggested_flag: suggestion.ai_suggested_flag,
          ai_suggested_interpretation: suggestion.ai_suggested_interpretation,
          updated_at: new Date().toISOString(),
        };

        // Also update the actual flag if requested
        if (applyToActualFlag && suggestion.ai_suggested_flag) {
          updateData.flag = suggestion.ai_suggested_flag;
        }

        const { error } = await database.supabase
          .from('result_values')
          .update(updateData)
          .eq('id', suggestion.id);

        if (error) {
          console.error(`Failed to save AI suggestion for ${suggestion.id}:`, error);
          failedCount++;
        } else {
          successCount++;
        }
      }

      setState({ loading: false, error: null });
      return { success: successCount, failed: failedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save AI suggestions';
      setState({ loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  /**
   * Get verifier summary for a test group
   * Call at TEST GROUP level before approval
   */
  const getVerifierSummary = useCallback(async (
    testGroup: TestGroupContext,
    resultValues: ResultValue[],
    patient?: PatientContext
  ): Promise<VerifierSummaryResponse> => {
    return callAIFunction<VerifierSummaryResponse>({
      action: 'verifier_summary',
      test_group: testGroup,
      result_values: resultValues,
      patient,
    });
  }, [callAIFunction]);

  /**
   * Get clinical summary for referring doctor
   * Call at ORDER level after all results are verified
   */
  const getClinicalSummary = useCallback(async (
    testGroups: Array<{
      name: string;
      category: string;
      result_values: ResultValue[];
    }>,
    patient?: PatientContext
  ): Promise<ClinicalSummaryResponse> => {
    return callAIFunction<ClinicalSummaryResponse>({
      action: 'clinical_summary',
      test_groups: testGroups,
      patient,
    });
  }, [callAIFunction]);

  return {
    // State
    loading: state.loading,
    error: state.error,
    
    // Actions
    generateMissingInterpretations,
    generateResultValueSuggestions,
    saveResultValueSuggestions,
    getVerifierSummary,
    getClinicalSummary,
    
    // Clear error utility
    clearError: useCallback(() => {
      setState(prev => ({ ...prev, error: null }));
    }, []),
  };
}

export default useAIResultIntelligence;
