import React, { useState, useEffect } from 'react';
import { X, Save, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

interface AIResultEntryProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderData?: any;
}

interface TestAnalyte {
  id: string;
  name: string;
  hasOCRProcessing: boolean;
  ocrStatus: 'available' | 'processing' | 'completed' | 'error';
  extractedValue?: string;
  confidence?: number;
}

const AIResultEntry: React.FC<AIResultEntryProps> = ({ isOpen, onClose, orderId }) => {
  const [analytes, setAnalytes] = useState<TestAnalyte[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderAnalytes();
    }
  }, [isOpen, orderId]);

  const loadOrderAnalytes = async () => {
    try {
      setLoading(true);
      
      // Mock data for demonstration - in real implementation, this would fetch from your database
      const mockAnalytes: TestAnalyte[] = [
        {
          id: '1',
          name: 'White Blood Cell Count',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '2',
          name: 'Red Blood Cell Count',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '3',
          name: 'Hemoglobin',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '4',
          name: 'Hematocrit',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '5',
          name: 'Mean Corpuscular Volume (MCV)',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '6',
          name: 'Mean Corpuscular Hemoglobin (MCH)',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '7',
          name: 'Mean Corpuscular Hemoglobin Concentration (MCHC)',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        },
        {
          id: '8',
          name: 'Red Cell Distribution Width (RDW)',
          hasOCRProcessing: true,
          ocrStatus: 'available'
        }
      ];

      setAnalytes(mockAnalytes);
    } catch (error) {
      console.error('Error loading analytes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOCRProcessing = async (analyteId: string) => {
    try {
      setProcessing(analyteId);
      
      // Update analyte status to processing
      setAnalytes(prev => prev.map(analyte => 
        analyte.id === analyteId 
          ? { ...analyte, ocrStatus: 'processing' }
          : analyte
      ));

      // Simulate OCR processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful processing result
      const mockExtractedValue = Math.random() > 0.5 ? (Math.random() * 100).toFixed(1) : null;
      const mockConfidence = Math.random() * 0.3 + 0.7; // 0.7 to 1.0

      setAnalytes(prev => prev.map(analyte => 
        analyte.id === analyteId 
          ? { 
              ...analyte, 
              ocrStatus: 'completed',
              extractedValue: mockExtractedValue || undefined,
              confidence: mockConfidence
            }
          : analyte
      ));

    } catch (error) {
      console.error('OCR processing error:', error);
      setAnalytes(prev => prev.map(analyte => 
        analyte.id === analyteId 
          ? { ...analyte, ocrStatus: 'error' }
          : analyte
      ));
    } finally {
      setProcessing(null);
    }
  };

  const getOCRButtonText = (analyte: TestAnalyte) => {
    switch (analyte.ocrStatus) {
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Reprocess';
      case 'error':
        return 'Retry OCR';
      default:
        return 'OCR Report Processing';
    }
  };

  const getOCRButtonColor = (analyte: TestAnalyte) => {
    switch (analyte.ocrStatus) {
      case 'processing':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />
        
        {/* Modal */}
        <div className="relative w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
              <p className="text-sm text-gray-500">Order ID: {orderId}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">
                Order Details
              </button>
              <button className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">
                AI Result Entry
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* AI-Powered Result Processing Header */}
            <div className="mb-6 rounded-lg bg-purple-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-purple-900">AI-Powered Result Processing</h3>
                  <p className="text-sm text-purple-700">
                    Available AI Processing for Order Analytes
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytes.map((analyte) => (
                  <div
                    key={analyte.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-2">
                          {analyte.name}
                        </h4>
                        
                        {analyte.ocrStatus === 'completed' && analyte.extractedValue && (
                          <div className="mb-3 p-2 bg-green-50 rounded border border-green-200">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-green-800">
                                Extracted: <strong>{analyte.extractedValue}</strong>
                              </span>
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              Confidence: {((analyte.confidence || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}

                        {analyte.ocrStatus === 'error' && (
                          <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
                            <div className="flex items-center gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="text-red-800">Processing failed</span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => handleOCRProcessing(analyte.id)}
                          disabled={processing === analyte.id}
                          className={`
                            w-full px-3 py-2 text-sm text-white rounded-md transition-colors
                            ${getOCRButtonColor(analyte)}
                            ${processing === analyte.id ? 'opacity-75 cursor-not-allowed' : ''}
                          `}
                        >
                          {processing === analyte.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Processing...
                            </div>
                          ) : (
                            getOCRButtonText(analyte)
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="text-sm text-gray-500">
              {analytes.filter(a => a.ocrStatus === 'completed').length} of {analytes.length} analytes processed
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                Save Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIResultEntry;
