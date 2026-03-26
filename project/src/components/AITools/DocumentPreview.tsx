import React, { useState } from 'react';
import { X, Eye, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface DocumentPreviewProps {
  attachment: {
    id: string;
    file_url: string;
    original_filename: string;
    ai_processed: boolean;
    ai_confidence?: number;
    processing_status?: string;
    ai_metadata?: any;
  };
  extractedData: any[];
  onClose: () => void;
  onAccept: (data: any[]) => void;
  onEdit: (data: any[]) => void;
}

const getFlagDisplay = (flag?: string) => {
  const rawFlag = flag || '';
  const normalizedFlag = rawFlag.trim().toLowerCase();

  if (['critical_h', 'critical high', 'critical_high', 'ch', 'h*', 'hh'].includes(normalizedFlag)) {
    return { label: 'Critical High', className: 'bg-red-100 text-red-800' };
  }

  if (['critical_l', 'critical low', 'critical_low', 'cl', 'l*', 'll'].includes(normalizedFlag)) {
    return { label: 'Critical Low', className: 'bg-blue-100 text-blue-800' };
  }

  if (normalizedFlag === 'h' || normalizedFlag === 'high') {
    return { label: 'High', className: 'bg-red-100 text-red-800' };
  }

  if (normalizedFlag === 'l' || normalizedFlag === 'low') {
    return { label: 'Low', className: 'bg-blue-100 text-blue-800' };
  }

  return { label: rawFlag, className: 'bg-orange-100 text-orange-800' };
};

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  attachment,
  extractedData,
  onClose,
  onAccept,
  onEdit
}) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
            <p className="text-sm text-gray-600">{attachment.original_filename}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-1 rounded"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex h-[calc(95vh-80px)]">
          {/* Left Panel - Document Image */}
          <div className="w-1/2 border-r border-gray-200 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900">Original Document</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">{zoom}%</span>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRotation((rotation + 90) % 360)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="bg-gray-100 rounded-lg h-full flex items-center justify-center overflow-auto">
              <img
                src={attachment.file_url}
                alt={attachment.original_filename}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'center'
                }}
              />
            </div>
          </div>

          {/* Right Panel - Extracted Data */}
          <div className="w-1/2 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900">AI Extracted Data</h3>
              {attachment.ai_confidence && (
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                  attachment.ai_confidence >= 0.95 ? 'bg-green-100 text-green-800' :
                  attachment.ai_confidence >= 0.90 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {Math.round(attachment.ai_confidence * 100)}% Confidence
                </span>
              )}
            </div>

            {/* AI Processing Info */}
            {attachment.ai_metadata && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="text-sm text-blue-800">
                  <div><strong>Processing Type:</strong> {attachment.ai_metadata.processing_type || 'OCR Report'}</div>
                  <div><strong>Features Used:</strong> {
                    Object.entries(attachment.ai_metadata.vision_features_used || {})
                      .filter(([_, used]) => used)
                      .map(([feature, _]) => feature)
                      .join(', ') || 'Text extraction'
                  }</div>
                  <div><strong>Text Length:</strong> {attachment.ai_metadata.text_length || 0} characters</div>
                </div>
              </div>
            )}

            {/* Extracted Parameters */}
            <div className="space-y-3 mb-6">
              {extractedData.map((param, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{param.parameter}</span>
                    {param.matched && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓ Matched
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Value:</span>
                      <div className="font-medium">{param.value}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit:</span>
                      <div>{param.unit || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Reference:</span>
                      <div className="text-xs">{param.reference_range || 'N/A'}</div>
                    </div>
                  </div>
                  {param.flag && (
                    <div className="mt-2">
                      {(() => {
                        const flagDisplay = getFlagDisplay(param.flag);
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${flagDisplay.className}`}>
                            {flagDisplay.label}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => onAccept(extractedData)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Accept All Data
              </button>
              <button
                onClick={() => onEdit(extractedData)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Review & Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;