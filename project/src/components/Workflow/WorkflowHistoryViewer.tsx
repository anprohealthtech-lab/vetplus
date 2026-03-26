import React, { useState, useEffect } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import { supabase } from '../../utils/supabase';
import { CheckCircle, Clock, AlertCircle, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import 'survey-core/defaultV2.min.css';

interface WorkflowHistoryViewerProps {
  orderId: string;
  testGroupId?: string;
  workflowMapId?: string;
  onReExecute?: () => void;
}

interface WorkflowExecution {
  id: string;
  workflow_version_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  current_step_id: string | null;
  workflow_versions: {
    version: number;
    definition: any;
    workflows: {
      name: string;
      description: string;
    };
  };
  workflow_results: Array<{
    id: string;
    step_id: string;
    status: string;
    review_status: string;
    payload: any;
    created_at: string;
  }>;
}

const WorkflowHistoryViewer: React.FC<WorkflowHistoryViewerProps> = ({
  orderId,
  testGroupId,
  workflowMapId,
  onReExecute,
}) => {
  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'survey'>('list');

  useEffect(() => {
    loadWorkflowExecutions();
  }, [orderId, testGroupId]);

  const loadWorkflowExecutions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('order_workflow_instances')
        .select(`
          id,
          workflow_version_id,
          status,
          started_at,
          completed_at,
          current_step_id,
          workflow_versions (
            version,
            definition,
            workflows (
              name,
              description
            )
          ),
          workflow_results (
            id,
            step_id,
            status,
            review_status,
            payload,
            created_at
          )
        `)
        .eq('order_id', orderId)
        .order('started_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setExecutions((data || []) as WorkflowExecution[]);
      
      // Auto-select the most recent execution
      if (data && data.length > 0) {
        setSelectedExecution(data[0] as WorkflowExecution);
        setExpandedExecution(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load workflow executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSurveyView = (execution: WorkflowExecution) => {
    if (!execution.workflow_results || execution.workflow_results.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No workflow data saved yet
        </div>
      );
    }

    // Get the latest workflow result with data
    const latestResult = execution.workflow_results
      .filter(r => r.payload?.results)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (!latestResult || !execution.workflow_versions?.definition) {
      return (
        <div className="text-center py-8 text-gray-500">
          No survey data available
        </div>
      );
    }

    try {
      const surveyModel = new Model(execution.workflow_versions.definition.ui?.template || execution.workflow_versions.definition);
      
      // Make survey read-only
      surveyModel.mode = 'display';
      
      // Load saved data
      surveyModel.data = latestResult.payload.results || {};

      return (
        <div className="border rounded-lg p-4 bg-gray-50">
          <Survey model={surveyModel} />
        </div>
      );
    } catch (error) {
      console.error('Failed to render survey:', error);
      return (
        <div className="text-center py-8 text-red-500">
          Failed to load survey view
        </div>
      );
    }
  };

  const renderResultsTree = (execution: WorkflowExecution) => {
    if (!execution.workflow_results || execution.workflow_results.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No execution steps recorded
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {execution.workflow_results.map((result, index) => (
          <div key={result.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  result.status === 'done' ? 'bg-green-100 text-green-600' :
                  result.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {result.status === 'done' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : result.status === 'in_progress' ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-900">
                    Step {index + 1}: {result.step_id}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {new Date(result.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                result.review_status === 'completed' ? 'bg-green-100 text-green-700' :
                result.review_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {result.review_status}
              </span>
            </div>

            {/* Show captured data */}
            {result.payload?.results && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                    View Data ({Object.keys(result.payload.results).length} fields)
                  </summary>
                  <div className="mt-2 space-y-2 pl-4">
                    {Object.entries(result.payload.results).map(([key, value]) => (
                      <div key={key} className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="text-gray-600 font-medium">{key}:</span>
                        <span className="text-gray-900">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="animate-spin h-8 w-8 text-blue-500 mr-3" />
        <span className="text-gray-600">Loading workflow history...</span>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Workflow Executions</h3>
        <p className="text-gray-600 mb-4">This order hasn't executed any workflows yet.</p>
        {onReExecute && (
          <button
            onClick={onReExecute}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Execute Workflow Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Execution List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Workflow Execution History ({executions.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {executions.map((execution) => (
            <div key={execution.id} className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => {
                  setExpandedExecution(expandedExecution === execution.id ? null : execution.id);
                  setSelectedExecution(execution);
                }}
              >
                <div className="flex items-center space-x-3">
                  {expandedExecution === execution.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {execution.workflow_versions?.workflows?.name || 'Workflow'}
                      <span className="ml-2 text-xs text-gray-500">
                        v{execution.workflow_versions?.version}
                      </span>
                    </h4>
                    <p className="text-sm text-gray-500">
                      Started: {new Date(execution.started_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  execution.status === 'completed' ? 'bg-green-100 text-green-700' :
                  execution.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {execution.status}
                </span>
              </div>

              {/* Expanded View */}
              {expandedExecution === execution.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {/* View Mode Tabs */}
                  <div className="flex space-x-2 mb-4">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewMode === 'list'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Step by Step
                    </button>
                    <button
                      onClick={() => setViewMode('survey')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewMode === 'survey'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Form View
                    </button>
                  </div>

                  {/* Content based on view mode */}
                  {viewMode === 'list' ? renderResultsTree(execution) : renderSurveyView(execution)}

                  {/* Re-execute button */}
                  {onReExecute && execution.status === 'completed' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={onReExecute}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        Execute Workflow Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowHistoryViewer;
