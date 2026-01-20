import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  FileText,
  Loader2,
  Upload,
  X,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../../utils/supabase';

interface Analyte {
  id: string;
  name: string;
  code: string;
  unit?: string | null;
  reference_range?: string | null;
}

interface TestGroup {
  id: string;
  name: string;
  category?: string | null;
}

interface ReportUploadModalProps {
  open: boolean;
  onClose: () => void;
  labId: string;
  onHtmlGenerated: (html: string, matchedAnalytes: string[], notes: string) => void;
}

type Step = 'select-group' | 'upload' | 'processing' | 'result';

const ReportUploadModal: React.FC<ReportUploadModalProps> = ({
  open,
  onClose,
  labId,
  onHtmlGenerated,
}) => {
  const [step, setStep] = useState<Step>('select-group');
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [testGroupsLoading, setTestGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<TestGroup | null>(null);
  const [analytes, setAnalytes] = useState<Analyte[]>([]);
  const [analytesLoading, setAnalytesLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    html: string;
    matchedAnalytes: string[];
    unmatchedTests: string[];
    notes: string;
  } | null>(null);

  // Fetch test groups on mount
  useEffect(() => {
    if (!open || !labId) return;

    const fetchTestGroups = async () => {
      setTestGroupsLoading(true);
      try {
        const { data, error } = await supabase
          .from('test_groups')
          .select('id, name, category')
          .eq('lab_id', labId)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setTestGroups(data || []);
      } catch (err: any) {
        console.error('Failed to fetch test groups:', err);
        setError('Failed to load test groups');
      } finally {
        setTestGroupsLoading(false);
      }
    };

    fetchTestGroups();
  }, [open, labId]);

  // Fetch analytes when test group is selected
  useEffect(() => {
    if (!selectedGroupId) {
      setAnalytes([]);
      return;
    }

    const fetchAnalytes = async () => {
      setAnalytesLoading(true);
      try {
        const { data, error } = await supabase
          .from('test_group_analytes')
          .select(`
            analyte_id,
            analytes (
              id,
              name,
              code,
              unit,
              reference_range
            )
          `)
          .eq('test_group_id', selectedGroupId);

        if (error) throw error;

        const analyteList: Analyte[] = (data || [])
          .map((row: any) => row.analytes)
          .filter((a: any) => a && a.id)
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            code: a.code || a.name.replace(/\s+/g, '_').toUpperCase(),
            unit: a.unit,
            reference_range: a.reference_range,
          }));

        setAnalytes(analyteList);
      } catch (err: any) {
        console.error('Failed to fetch analytes:', err);
        setError('Failed to load analytes for this test group');
      } finally {
        setAnalytesLoading(false);
      }
    };

    fetchAnalytes();
  }, [selectedGroupId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep('select-group');
      setSelectedGroupId('');
      setSelectedGroup(null);
      setAnalytes([]);
      setFile(null);
      setFilePreview(null);
      setProcessing(false);
      setError(null);
      setResult(null);
    }
  }, [open]);

  const handleGroupSelect = (groupId: string) => {
    const group = testGroups.find((g) => g.id === groupId);
    setSelectedGroupId(groupId);
    setSelectedGroup(group || null);
    setError(null);
  };

  const handleContinueToUpload = () => {
    if (!selectedGroupId || analytes.length === 0) {
      setError('Please select a test group with analytes');
      return;
    }
    setStep('upload');
    setError(null);
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PNG, JPEG, WebP image or PDF file');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        // Create a synthetic event to reuse the file change handler
        const syntheticEvent = {
          target: { files: [droppedFile] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileChange(syntheticEvent);
      }
    },
    [handleFileChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleProcessFile = async () => {
    if (!file || !selectedGroup || analytes.length === 0) return;

    setStep('processing');
    setProcessing(true);
    setError(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get pure base64
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call the Netlify function
      const response = await fetch('/.netlify/functions/report-to-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
          analytes: analytes,
          testGroupName: selectedGroup.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process report');
      }

      setResult({
        html: data.html,
        matchedAnalytes: data.matchedAnalytes || [],
        unmatchedTests: data.unmatchedTests || [],
        notes: data.notes || '',
      });
      setStep('result');
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process the report');
      setStep('upload');
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyResult = () => {
    if (result) {
      onHtmlGenerated(result.html, result.matchedAnalytes, result.notes);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate Template from Report</h2>
              <p className="text-sm text-gray-500">
                Upload a report image to create an HTML template with placeholders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {(['select-group', 'upload', 'processing', 'result'] as Step[]).map((s, idx) => (
              <React.Fragment key={s}>
                <div
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    step === s
                      ? 'bg-indigo-600 text-white'
                      : idx < ['select-group', 'upload', 'processing', 'result'].indexOf(step)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {idx < ['select-group', 'upload', 'processing', 'result'].indexOf(step) ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 3 && (
                  <div
                    className={clsx(
                      'h-0.5 flex-1',
                      idx < ['select-group', 'upload', 'processing', 'result'].indexOf(step)
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Select Test Group */}
          {step === 'select-group' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Test Group
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Choose the test group to get the available analytes for placeholder mapping.
                </p>

                {testGroupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    <span className="ml-2 text-gray-500">Loading test groups...</span>
                  </div>
                ) : (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => handleGroupSelect(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">Select a test group...</option>
                    {testGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} {group.category && `(${group.category})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Show analytes preview */}
              {selectedGroupId && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Analytes ({analytes.length})
                  </label>
                  {analytesLoading ? (
                    <div className="flex items-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      <span className="ml-2 text-sm text-gray-500">Loading analytes...</span>
                    </div>
                  ) : analytes.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      No analytes found for this test group. Please add analytes first.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex flex-wrap gap-2">
                        {analytes.map((analyte) => (
                          <span
                            key={analyte.id}
                            className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700"
                            title={`Code: ${analyte.code}, Unit: ${analyte.unit || 'N/A'}`}
                          >
                            {analyte.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Upload File */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={clsx(
                  'relative rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                  file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'
                )}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />

                {file ? (
                  <div className="space-y-3">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="mx-auto max-h-48 rounded-lg object-contain shadow-md"
                      />
                    ) : (
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl bg-indigo-100">
                        <FileText className="h-10 w-10 text-indigo-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setFilePreview(null);
                      }}
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" /> Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-100">
                      <Upload className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div className="mt-4">
                      <p className="text-gray-700">
                        <span className="font-semibold text-indigo-600">Click to upload</span> or
                        drag and drop
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        PNG, JPEG, WebP, or PDF (max 10MB)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Selected group info */}
              <div className="rounded-lg bg-gray-100 p-4">
                <p className="text-sm">
                  <span className="font-medium text-gray-700">Test Group:</span>{' '}
                  <span className="text-gray-900">{selectedGroup?.name}</span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-medium text-gray-700">Analytes:</span>{' '}
                  <span className="text-gray-900">{analytes.length} parameters</span>
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-indigo-200" />
                <div className="absolute inset-0 h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-indigo-600" />
                <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="mt-6 text-lg font-medium text-gray-900">Analyzing Report</h3>
              <p className="mt-2 text-center text-sm text-gray-500 max-w-sm">
                AI is examining the report layout, identifying test parameters, and generating the
                HTML template with proper placeholders...
              </p>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-800">Template Generated Successfully</p>
                </div>
                {result.notes && (
                  <p className="mt-2 text-sm text-green-700">{result.notes}</p>
                )}
              </div>

              {/* Matched analytes */}
              {result.matchedAnalytes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Matched Analytes ({result.matchedAnalytes.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {result.matchedAnalytes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched tests warning */}
              {result.unmatchedTests.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Unmatched Tests Found</p>
                      <p className="text-sm text-amber-700 mt-1">
                        These tests from the report couldn't be matched to available analytes:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.unmatchedTests.map((test, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
                          >
                            {test}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* HTML Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generated HTML Preview
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-900 p-4 max-h-64 overflow-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                    {result.html.slice(0, 2000)}
                    {result.html.length > 2000 && '...'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={() => {
              if (step === 'upload') {
                setStep('select-group');
              } else if (step === 'result') {
                setStep('upload');
              } else {
                onClose();
              }
            }}
            disabled={processing}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {step === 'select-group' ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={() => {
              if (step === 'select-group') {
                handleContinueToUpload();
              } else if (step === 'upload') {
                handleProcessFile();
              } else if (step === 'result') {
                handleApplyResult();
              }
            }}
            disabled={
              processing ||
              (step === 'select-group' && (!selectedGroupId || analytes.length === 0)) ||
              (step === 'upload' && !file)
            }
            className={clsx(
              'rounded-lg px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50',
              step === 'result'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
          >
            {step === 'select-group' && 'Continue'}
            {step === 'upload' && (
              <>
                <Sparkles className="inline h-4 w-4 mr-1" />
                Generate Template
              </>
            )}
            {step === 'processing' && (
              <>
                <Loader2 className="inline h-4 w-4 mr-1 animate-spin" />
                Processing...
              </>
            )}
            {step === 'result' && 'Apply to Editor'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportUploadModal;
