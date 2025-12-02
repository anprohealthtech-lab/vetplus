import React, { useState } from 'react';
import { Sparkles, Check, X, Edit2, TrendingUp } from 'lucide-react';
import { database } from '../../utils/supabase';

interface AIResultSuggestionCardProps {
  resultValue: {
    id: string;
    analyte_id?: string;
    analyte_name: string;
    value: string;
    unit?: string;
    reference_range?: string;
    flag?: string | null;
    interpretation?: string | null;
    ai_suggested_flag?: string | null;
    ai_suggested_interpretation?: string | null;
    trend_interpretation?: string | null;
  };
  onApplied?: () => void;
}

const AIResultSuggestionCard: React.FC<AIResultSuggestionCardProps> = ({
  resultValue,
  onApplied
}) => {
  const [flag, setFlag] = useState(resultValue.flag || resultValue.ai_suggested_flag || '');
  const [interpretation, setInterpretation] = useState(
    resultValue.interpretation || resultValue.ai_suggested_interpretation || ''
  );
  const [isEditingFlag, setIsEditingFlag] = useState(false);
  const [isEditingInterpretation, setIsEditingInterpretation] = useState(false);
  const [applying, setApplying] = useState(false);

  const hasAISuggestion = resultValue.ai_suggested_flag || resultValue.ai_suggested_interpretation;
  const flagChanged = flag !== resultValue.ai_suggested_flag;
  const interpretationChanged = interpretation !== resultValue.ai_suggested_interpretation;
  const isModified = flagChanged || interpretationChanged;

  const handleAcceptAI = async () => {
    setApplying(true);
    try {
      const { error } = await database.aiAnalysis.applyAISuggestions(resultValue.id, {
        applyFlag: true,
        applyInterpretation: true
      });

      if (error) throw error;
      onApplied?.();
    } catch (err) {
      console.error('Failed to apply AI suggestions:', err);
      alert('Failed to apply AI suggestions');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyCustom = async () => {
    setApplying(true);
    try {
      const { error } = await database.aiAnalysis.applyAISuggestions(resultValue.id, {
        applyFlag: false,
        applyInterpretation: false,
        customFlag: flag || null,
        customInterpretation: interpretation || null
      });

      if (error) throw error;
      setIsEditingFlag(false);
      setIsEditingInterpretation(false);
      onApplied?.();
    } catch (err) {
      console.error('Failed to apply custom values:', err);
      alert('Failed to apply changes');
    } finally {
      setApplying(false);
    }
  };

  const getFlagLabel = (flagValue: string | null) => {
    if (!flagValue) return 'Normal';
    switch (flagValue.toUpperCase()) {
      case 'H': return 'High ↑';
      case 'L': return 'Low ↓';
      case 'C': return 'Critical ⚠️';
      case 'N': return 'Normal';
      default: return flagValue;
    }
  };

  const getFlagColor = (flagValue: string | null) => {
    if (!flagValue || flagValue === 'N') return 'text-green-700 bg-green-50 border-green-200';
    switch (flagValue.toUpperCase()) {
      case 'H': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'L': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'C': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="border rounded-lg bg-white hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-semibold text-gray-900">{resultValue.analyte_name}</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-900">{resultValue.value}</span>
              <span className="text-sm text-gray-600">{resultValue.unit}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Reference: {resultValue.reference_range || 'N/A'}</p>
          </div>
          
          {/* Flag Display/Editor */}
          <div className="flex flex-col items-end gap-1">
            {isEditingFlag ? (
              <select 
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Normal</option>
                <option value="L">Low ↓</option>
                <option value="H">High ↑</option>
                <option value="C">Critical ⚠️</option>
              </select>
            ) : (
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getFlagColor(flag)}`}>
                {getFlagLabel(flag)}
              </div>
            )}
            
            {hasAISuggestion && !isEditingFlag && (
              <button
                onClick={() => setIsEditingFlag(true)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            )}
            
            {flagChanged && (
              <span className="text-xs text-yellow-700 font-medium">Modified</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Suggestion Panel */}
      {hasAISuggestion && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-900 mb-2">AI Suggestion</p>
              
              {resultValue.ai_suggested_flag && (
                <div className="mb-2">
                  <span className="text-xs text-blue-700 font-medium">Flag: </span>
                  <span className="text-sm text-blue-800">{getFlagLabel(resultValue.ai_suggested_flag)}</span>
                </div>
              )}
              
              {resultValue.ai_suggested_interpretation && (
                <div className="mb-2">
                  <span className="text-xs text-blue-700 font-medium">Interpretation: </span>
                  <p className="text-sm text-blue-800 mt-1">{resultValue.ai_suggested_interpretation}</p>
                </div>
              )}
              
              {resultValue.trend_interpretation && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                    <span className="text-xs text-blue-700 font-medium">Trend: </span>
                  </div>
                  <p className="text-sm text-blue-800">{resultValue.trend_interpretation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interpretation Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Clinical Interpretation
            {interpretationChanged && <span className="text-yellow-600 ml-2 text-xs">(Modified)</span>}
          </label>
          {!isEditingInterpretation && interpretation && (
            <button
              onClick={() => setIsEditingInterpretation(true)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
        
        {isEditingInterpretation ? (
          <textarea
            value={interpretation}
            onChange={(e) => setInterpretation(e.target.value)}
            placeholder="Add clinical interpretation..."
            className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {interpretation || <span className="text-gray-400 italic">No interpretation provided</span>}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t bg-gray-50 flex gap-2">
        {hasAISuggestion && !isModified && (
          <button
            onClick={handleAcceptAI}
            disabled={applying}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            Accept AI Suggestion
          </button>
        )}
        
        {isModified && (
          <>
            <button
              onClick={() => {
                setFlag(resultValue.ai_suggested_flag || '');
                setInterpretation(resultValue.ai_suggested_interpretation || '');
                setIsEditingFlag(false);
                setIsEditingInterpretation(false);
              }}
              disabled={applying}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleApplyCustom}
              disabled={applying}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply Changes
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AIResultSuggestionCard;
