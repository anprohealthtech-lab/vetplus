import React, { useState, useEffect } from 'react';
import { Brain, Edit2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { database } from '../../utils/supabase';
import { useAIResultIntelligence } from '../../hooks/useAIResultIntelligence';

interface AIDoctorSummaryPanelProps {
  orderId: string;
  patientId: string;
  results: any[];
  onSaved?: () => void;
}

const AIDoctorSummaryPanel: React.FC<AIDoctorSummaryPanelProps> = ({
  orderId,
  patientId,
  results,
  onSaved
}) => {
  const { getClinicalSummary, loading: aiLoading } = useAIResultIntelligence();
  const [summary, setSummary] = useState('');
  const [originalSummary, setOriginalSummary] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);

  // Load existing AI summary
  useEffect(() => {
    const loadExistingSummary = async () => {
      try {
        const { data, error: fetchError } = await database.supabase
          .from('reports')
          .select('ai_doctor_summary, ai_summary_generated_at')
          .eq('order_id', orderId)
          .order('generated_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!fetchError && data?.ai_doctor_summary) {
          setSummary(data.ai_doctor_summary);
          setOriginalSummary(data.ai_doctor_summary);
          setHasExisting(true);
        }
      } catch (err) {
        console.error('Failed to load existing summary:', err);
      }
    };
    loadExistingSummary();
  }, [orderId]);

  const handleGenerateSummary = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Get patient info
      const { data: patientData } = await database.patients.getById(patientId);
      
      // Prepare test groups with results
      const testGroups = results.map(result => ({
        name: result.test_name || 'Test Panel',
        category: result.test_group?.category || 'General',
        result_values: result.result_values?.map((rv: any) => ({
          analyte_name: rv.analyte_name,
          value: rv.value,
          unit: rv.unit,
          reference_range: rv.reference_range,
          flag: rv.flag,
          interpretation: rv.interpretation || rv.ai_suggested_interpretation
        })) || []
      }));

      // Call AI to generate summary
      const aiSummary = await getClinicalSummary(testGroups, {
        age: patientData?.age,
        gender: patientData?.gender,
        clinical_notes: ''
      });

      // Format the AI response into readable text
      const formattedSummary = `
**Executive Summary:**
${aiSummary.executive_summary}

**Significant Findings:**
${aiSummary.significant_findings?.map(f => `• ${f.finding} (${f.test_group})\n  Clinical Significance: ${f.clinical_significance}`).join('\n\n') || 'No significant findings'}

${aiSummary.urgent_findings && aiSummary.urgent_findings.length > 0 ? `
**Urgent Findings:**
${aiSummary.urgent_findings.map(f => `⚠️ ${f}`).join('\n')}
` : ''}

${aiSummary.suggested_followup && aiSummary.suggested_followup.length > 0 ? `
**Recommended Follow-up:**
${aiSummary.suggested_followup.map(f => `• ${f}`).join('\n')}
` : ''}

**Clinical Interpretation:**
${aiSummary.clinical_interpretation}
      `.trim();

      setSummary(formattedSummary);
      setOriginalSummary(formattedSummary);
      setIsEditing(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI summary');
      console.error('AI summary generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: saveError } = await database.aiAnalysis.saveDoctorSummary(
        orderId,
        summary
      );

      if (saveError) throw saveError;

      setHasExisting(true);
      setIsEditing(false);
      setOriginalSummary(summary);
      onSaved?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save AI summary');
      console.error('Failed to save AI summary:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setSummary(originalSummary);
    setIsEditing(false);
  };

  const isModified = summary !== originalSummary;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow border border-purple-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Clinical Summary for Doctor</h3>
          {hasExisting && !isModified && (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
              Saved
            </span>
          )}
          {isModified && (
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
              Modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!summary && (
            <button
              onClick={handleGenerateSummary}
              disabled={generating || aiLoading || results.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              Generate Summary
            </button>
          )}

          {summary && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}

          {isEditing && (
            <>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !summary}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save to Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Display/Editor */}
      {summary ? (
        isEditing ? (
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="AI-generated clinical summary will appear here..."
          />
        ) : (
          <div className="bg-white rounded-lg border border-purple-200 p-4 prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">{summary}</pre>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm">Click "Generate Summary" to create AI clinical summary</p>
          {results.length === 0 && (
            <p className="text-xs text-red-600 mt-1">No results available for summary generation</p>
          )}
        </div>
      )}

      {/* Info Footer */}
      {summary && !isEditing && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          This AI-generated summary will be included in the PDF report for the referring doctor
        </p>
      )}
    </div>
  );
};

export default AIDoctorSummaryPanel;
