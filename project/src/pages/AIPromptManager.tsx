import React, { useState, useEffect } from 'react';
import { Brain, Save, Trash2, Plus, AlertCircle, CheckCircle, Sparkles, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { getAIPrompts, saveAIPrompt, deleteAIPrompt } from '../utils/aiPromptService';
import { database } from '../utils/supabase';
import PromptAssistant from '../components/AI/PromptAssistant';

interface TestGroup {
  id: string;
  name: string;
  code: string;
  analytes?: Array<{ id: string; name: string; unit?: string; reference_range?: string }>;
}

interface AIPrompt {
  id: string;
  prompt: string;
  ai_processing_type: string;
  test_id?: string;
  lab_id?: string;
  analyte_id?: string;
  default: boolean;
  created_at: string;
  test_groups?: { name: string };
  labs?: { name: string };
  analytes?: { name: string };
}

const processingTypes = [
  { value: 'nlp_extraction', label: 'TRF NLP Extraction', icon: '🧠' },
  { value: 'ocr_report', label: 'OCR Report Processing', icon: '📄' },
  { value: 'vision_card', label: 'Vision Card Analysis', icon: '👁️' },
  { value: 'vision_color', label: 'Vision Color Detection', icon: '🎨' }
];

export default function AIPromptManager() {
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form state
  const [selectedProcessingType, setSelectedProcessingType] = useState('nlp_extraction');
  const [selectedTestGroup, setSelectedTestGroup] = useState<string>('');
  const [promptText, setPromptText] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  
  // UI state
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [selectedTestGroupAnalytes, setSelectedTestGroupAnalytes] = useState<Array<{ id: string; name: string; unit?: string; reference_range?: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Fetch analytes when test group is selected
    const fetchAnalytes = async () => {
      if (selectedTestGroup) {
        try {
          const { data, error } = await database.testGroups.getById(selectedTestGroup);
          console.log('Fetched test group data:', { data, error });
          if (!error && data?.test_group_analytes) {
            // Extract analytes from the nested structure
            const analytes = data.test_group_analytes
              .map((tga: any) => tga.analytes)
              .filter((a: any) => a !== null);
            console.log('Extracted analytes:', analytes);
            setSelectedTestGroupAnalytes(analytes);
          } else {
            console.log('No analytes found in test group');
            setSelectedTestGroupAnalytes([]);
          }
        } catch (error) {
          console.error('Error fetching analytes:', error);
          setSelectedTestGroupAnalytes([]);
        }
      } else {
        setSelectedTestGroupAnalytes([]);
      }
    };
    fetchAnalytes();
  }, [selectedTestGroup]);

  const loadData = async () => {
    setLoading(true);
    try {
      const testGroupsResult = await database.testGroups.getAll();
      const promptsData = await getAIPrompts();
      
      setTestGroups((testGroupsResult?.data || []) as TestGroup[]);
      setPrompts(promptsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleNewPrompt = () => {
    setEditingPromptId(null);
    setPromptText('');
    setSelectedTestGroup('');
    setIsDefault(false);
    setShowEditor(true);
  };

  const handleEditPrompt = (prompt: AIPrompt) => {
    setEditingPromptId(prompt.id);
    setPromptText(prompt.prompt);
    setSelectedProcessingType(prompt.ai_processing_type);
    setSelectedTestGroup(prompt.test_id || '');
    setIsDefault(prompt.default);
    setShowEditor(true);
  };

  const handleSavePrompt = async () => {
    if (!promptText.trim()) {
      showMessage('error', 'Prompt text is required');
      return;
    }

    setSaving(true);
    try {
      const userLabId = await database.getCurrentUserLabId();
      
      const result = await saveAIPrompt({
        prompt: promptText,
        processingType: selectedProcessingType,
        testGroupId: selectedTestGroup || undefined,
        labId: !isDefault && userLabId ? userLabId : undefined,
        isDefault
      });

      if (result.success) {
        showMessage('success', editingPromptId ? 'Prompt updated successfully' : 'Prompt created successfully');
        setShowEditor(false);
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to save prompt');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const result = await deleteAIPrompt(promptId);
      if (result.success) {
        showMessage('success', 'Prompt deleted successfully');
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to delete prompt');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to delete prompt');
    }
  };

  const filteredPrompts = prompts.filter(p => p.ai_processing_type === selectedProcessingType);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Brain className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Prompt Manager</h1>
                <p className="text-gray-600 text-sm mt-1">
                  Configure custom AI prompts for test groups and processing types
                </p>
              </div>
            </div>
            <button
              onClick={handleNewPrompt}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              <Plus className="h-5 w-5" />
              New Prompt
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Processing Type Selector */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Processing Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {processingTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setSelectedProcessingType(type.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProcessingType === type.value
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">{type.icon}</div>
                <div className={`text-sm font-medium ${
                  selectedProcessingType === type.value ? 'text-purple-900' : 'text-gray-900'
                }`}>
                  {type.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Editor */}
        {showEditor && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                {editingPromptId ? 'Edit Prompt' : 'Create New Prompt'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Test Group Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Group (Optional)
                </label>
                <select
                  value={selectedTestGroup}
                  onChange={(e) => setSelectedTestGroup(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Test Groups (Global Prompt)</option>
                  {testGroups.map(test => (
                    <option key={test.id} value={test.id}>
                      {test.name} ({test.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for a global prompt, or select a test group for specific customization
                </p>
              </div>

              {/* Default Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="is-default" className="text-sm font-medium text-gray-700">
                  Set as default prompt (applies when no specific prompt exists)
                </label>
              </div>

              {/* Prompt Text Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Prompt Text
                  </label>
                  <button
                    onClick={() => setShowAssistant(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 text-sm font-medium transition"
                  >
                    <MessageCircle className="h-4 w-4" />
                    AI Assistant
                  </button>
                </div>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={15}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter your AI prompt here... Be specific about the extraction format and guidelines.

Click 'AI Assistant' for interactive help building the perfect prompt!"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Characters: {promptText.length}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSavePrompt}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Prompt'}
                </button>
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Prompts List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Existing Prompts for {processingTypes.find(t => t.value === selectedProcessingType)?.label}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''} configured
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredPrompts.length === 0 ? (
              <div className="p-12 text-center">
                <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No prompts configured yet</p>
                <p className="text-sm text-gray-400">
                  Create your first prompt to customize AI behavior
                </p>
              </div>
            ) : (
              filteredPrompts.map(prompt => (
                <div key={prompt.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {prompt.test_groups?.name || 'Global Prompt'}
                        </h3>
                        {prompt.default && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Default
                          </span>
                        )}
                        {prompt.test_id && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                            Test-Specific
                          </span>
                        )}
                        {prompt.lab_id && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Lab-Specific
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-3">
                        Created: {new Date(prompt.created_at).toLocaleDateString()}
                      </div>

                      {/* Expandable Prompt Preview */}
                      <div>
                        <button
                          onClick={() => setExpandedPrompt(expandedPrompt === prompt.id ? null : prompt.id)}
                          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium mb-2"
                        >
                          {expandedPrompt === prompt.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          {expandedPrompt === prompt.id ? 'Hide' : 'Show'} Prompt
                        </button>
                        
                        {expandedPrompt === prompt.id && (
                          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-200">
                            {prompt.prompt}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditPrompt(prompt)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit prompt"
                      >
                        <Sparkles className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(prompt.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete prompt"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How AI Prompt Hierarchy Works
          </h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex gap-2">
              <span className="font-bold">1.</span>
              <span><strong>Lab + Test Specific:</strong> Highest priority - customized for specific lab and test group</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">2.</span>
              <span><strong>Test Specific:</strong> Applied to specific test group across all labs</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">3.</span>
              <span><strong>Test Group Level:</strong> Uses prompt from test_groups.group_level_prompt</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">4.</span>
              <span><strong>Default Prompt:</strong> System-wide default for the processing type</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">5.</span>
              <span><strong>Hardcoded Fallback:</strong> Built-in prompt if nothing else is configured</span>
            </li>
          </ol>
        </div>
      </div>

      {/* AI Prompt Assistant Modal */}
      {showAssistant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Prompt Assistant
              </h3>
              <button
                onClick={() => setShowAssistant(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <PromptAssistant
                testGroupName={selectedTestGroup ? testGroups.find(tg => tg.id === selectedTestGroup)?.name : undefined}
                analytes={selectedTestGroupAnalytes}
                processingType={selectedProcessingType}
                currentPrompt={promptText}
                onPromptGenerated={(prompt, type) => {
                  setPromptText(prompt);
                  setSelectedProcessingType(type);
                  setShowAssistant(false);
                  showMessage('success', 'Prompt generated successfully! Review and save.');
                }}
                onClose={() => setShowAssistant(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
