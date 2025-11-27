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
  analyte_name: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: 'H' | 'L' | 'C' | null;
  interpretation?: string | null;
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
   * Save AI-generated interpretations to the database (lab_analytes table)
   * @param labId - The lab ID to save interpretations for
   * @param interpretations - The AI-generated interpretations to save
   */
  const saveInterpretationsToDb = useCallback(async (
    labId: string,
    interpretations: GeneratedInterpretation[]
  ): Promise<{ success: string[]; failed: string[] }> => {
    setState({ loading: true, error: null });
    
    try {
      const { data, error } = await database.labAnalytes.updateInterpretations(
        labId,
        interpretations.map(interp => ({
          analyte_id: interp.analyte_id,
          interpretation_low: interp.interpretation_low,
          interpretation_normal: interp.interpretation_normal,
          interpretation_high: interp.interpretation_high,
        }))
      );

      if (error) {
        throw error;
      }

      setState({ loading: false, error: null });
      return data || { success: [], failed: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save interpretations';
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
    saveInterpretationsToDb,
    getVerifierSummary,
    getClinicalSummary,
    
    // Clear error utility
    clearError: useCallback(() => {
      setState(prev => ({ ...prev, error: null }));
    }, []),
  };
}

export default useAIResultIntelligence;
