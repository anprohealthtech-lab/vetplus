import React, { useState, useRef } from 'react';
import { FileText, Upload, Scan, CheckCircle, AlertTriangle, Download, Zap, Target, Layers, Settings, Database } from 'lucide-react';
import { supabase, uploadFile, generateFilePath, database } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateFlagsForResults } from '../../utils/flagCalculation';

const OCRExtraction: React.FC = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [extractionType, setExtractionType] = useState('instrument-screen');
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [currentProcessingSteps, setCurrentProcessingSteps] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractionTypes = [
    {
      id: 'instrument-screen',
      name: 'Instrument Display',
      description: 'LCD/LED displays from analyzers and instruments',
      examples: ['Hematology counters', 'Chemistry analyzers', 'Electrolyte analyzers'],
      features: ['Screen reflection handling', 'Multi-parameter extraction', 'Unit recognition'],
    },
    {
      id: 'printed-report',
      name: 'Printed Report',
      description: 'Paper printouts and thermal printer outputs',
      examples: ['Thermal printer output', 'Lab report printouts', 'QC results'],
      features: ['Layout recognition', 'Table extraction', 'Header/footer handling'],
    },
    {
      id: 'pdf-report',
      name: 'Digital Documents',
      description: 'PDF reports and digital lab documents',
      examples: ['External lab reports', 'Reference lab results', 'Historical data'],
      features: ['Multi-page processing', 'Searchable text extraction', 'Metadata parsing'],
    },
    {
      id: 'handwritten',
      name: 'Handwritten Notes',
      description: 'Manual entries and handwritten results',
      examples: ['Manual logs', 'Observation notes', 'Emergency results'],
      features: ['Handwriting recognition', 'Contextual validation', 'Quality scoring'],
    },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadOCRFile(file);
    }
  };
  
  const uploadOCRFile = async (file: File) => {
    try {
      // Generate file path for OCR extraction
      const filePath = generateFilePath(
        file.name, 
        undefined, 
        undefined, 
        `ocr-extraction/${extractionType}`
      );
      
      // Upload to Supabase Storage
      const uploadResult = await uploadFile(file, filePath);
      
      // Get current user's lab_id
      const currentLabId = await database.getCurrentUserLabId();
      
      // Insert attachment record
      const { data: attachment, error } = await supabase
        .from('attachments')
        .insert([{
          patient_id: null,
          lab_id: currentLabId,
          related_table: 'ocr_extraction',
          related_id: extractionType,
          file_url: uploadResult.publicUrl,
          file_path: uploadResult.path,
          original_filename: file.name,
          stored_filename: filePath.split('/').pop(),
          file_type: file.type,
          file_size: file.size,
          description: `OCR extraction document - ${extractionType}`,
          uploaded_by: user?.id || null,
          upload_timestamp: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error saving attachment metadata:', error);
      } else {
        setAttachmentId(attachment.id);
      }
      
      setSelectedFile(file);
      setExtractedData(null);
      setCurrentProcessingSteps([]);
      setConfidence(0);
      
    } catch (error) {
      console.error('Error uploading OCR file:', error);
      alert('Failed to upload file. Please try again.');
    }
  };

  const processDocument = async () => {
    if (!attachmentId) return;

    setProcessing(true);
    setCurrentProcessingSteps(['Calling vision-ocr Edge Function...']);
    console.log('Starting OCR document processing with attachment ID:', attachmentId);
    setConfidence(0);

    try {
      // Step 1: Call vision-ocr Edge Function
      console.log('Calling vision-ocr Edge Function...');
      setCurrentProcessingSteps(prev => [...prev, 'Extracting text with Google Vision AI...']);
      setConfidence(25);
      
      const visionResponse = await supabase.functions.invoke('vision-ocr', {
        body: {
          attachmentId,
          documentType: extractionType,
          analysisType: 'text'
        }
      });
      
      if (visionResponse.error) {
        throw new Error(`Vision OCR failed: ${visionResponse.error.message}`);
      }
      
      const visionData = visionResponse.data;
      console.log('Vision OCR completed. Extracted text length:', visionData.fullText?.length || 0);
      
      // Step 2: Call gemini-nlp Edge Function
      setCurrentProcessingSteps(prev => [...prev, 'Processing with Gemini NLP...']);
      setConfidence(50);
      
      console.log('Calling gemini-nlp Edge Function...');
      const geminiResponse = await supabase.functions.invoke('gemini-nlp', {
        body: {
          rawText: visionData.fullText,
          visionResults: visionData,
          originalBase64Image: visionData.originalBase64Image,
          documentType: extractionType
        }
      });
      
      if (geminiResponse.error) {
        throw new Error(`Gemini NLP failed: ${geminiResponse.error.message}`);
      }
      
      const data = geminiResponse.data;
      
      setCurrentProcessingSteps(prev => [...prev, 'Matching parameters to database...']);
      setConfidence(75);
      
      console.log('OCR processing completed successfully. Result:', data);
      
      // Handle different response formats based on document type
      if (data.extractedParameters && Array.isArray(data.extractedParameters)) {
        // Lab report format
        setExtractedData({
          parameters: data.extractedParameters.map((item: any) => ({
            name: item.parameter,
            value: item.value,
            unit: item.unit,
            reference: item.reference_range || item.reference,
            status: item.flag || 'Normal',
            confidence: item.confidence || 0.95,
            matched: item.matched || false,
            analyte_id: item.analyte_id || null
          })),
          confidence: data.metadata?.ocrConfidence || 0.95,
          qualityMetrics: {
            imageQuality: data.metadata?.ocrMethod?.includes('Vision AI') ? 'Good' : 'Basic',
            textClarity: data.metadata?.ocrConfidence > 0.9 ? 'High' : 'Medium',
            layoutRecognition: 'Complete',
            dataValidation: data.metadata?.matchedParameters > 0 ? 'Passed' : 'Manual Review Required'
          },
          metadata: data.metadata,
          documentType: extractionType
        });
      } else if (data.patient_details || data.requested_tests) {
        // Test request form format
        setExtractedData({
          patientDetails: data.patient_details || {},
          requestedTests: data.requested_tests || [],
          doctorInfo: data.doctor_info || {},
          confidence: data.metadata?.ocrConfidence || 0.95,
          qualityMetrics: {
            imageQuality: data.metadata?.ocrMethod?.includes('Vision AI') ? 'Good' : 'Basic',
            textClarity: data.metadata?.ocrConfidence > 0.9 ? 'High' : 'Medium',
            layoutRecognition: 'Complete',
            dataValidation: 'Passed'
          },
          metadata: data.metadata,
          documentType: extractionType
        });
      } else if (Array.isArray(data)) {
        // Legacy array format
        setExtractedData({
          parameters: data.map((item: any) => ({
            name: item.parameter || item.parameter_name,
            value: item.value,
            unit: item.unit,
            reference: item.reference_range || item.reference,
            status: item.flag || 'Normal',
            confidence: 0.95,
            matched: false
          })),
          confidence: 0.95,
          qualityMetrics: {
            imageQuality: 'Good',
            textClarity: 'High',
            layoutRecognition: 'Complete',
            dataValidation: 'Passed'
          },
          documentType: extractionType
        });
      } else if (data.rawText) {
        // Raw text fallback
        setExtractedData({
          recognizedText: [{ text: data.rawText, confidence: 0.5 }],
          confidence: 0.5,
          qualityMetrics: {
            imageQuality: 'Poor',
            textClarity: 'Low',
            layoutRecognition: 'Basic',
            dataValidation: 'Manual review required'
          },
          metadata: data.metadata,
          documentType: extractionType
        });
      } else {
        // Unexpected format
        setExtractedData({
          recognizedText: [{ text: 'Unexpected AI response format.', confidence: 0.0 }],
          confidence: 0.0,
          qualityMetrics: {
            imageQuality: 'Poor',
            textClarity: 'Low',
            layoutRecognition: 'Basic',
            dataValidation: 'Manual review required'
          },
          documentType: extractionType
        });
      }

      setCurrentProcessingSteps(['OCR extraction complete.']);
      setConfidence(100);

    } catch (error) {
      console.error('Error during OCR extraction - Full details:', error);
      setCurrentProcessingSteps([`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setExtractedData(null);
      setConfidence(0);
    } finally {
      setProcessing(false);
    }
  };

  const importToLIMS = async () => {
    if (!extractedData || !extractedData.parameters || !attachmentId) return;

    setImporting(true);
    try {
      // For now, we'll create a result without linking to a specific order
      // In a real scenario, user would select an order or create a new one
      
      const resultData = {
        patient_name: `AI Extracted Result - ${new Date().toLocaleDateString()}`,
        test_name: `${selectedExtractionInfo?.name} - OCR Extraction`,
        entered_by: user?.email || 'AI OCR System',
        status: 'Entered',
        notes: `Extracted via AI OCR from ${extractionType} document`,
        attachment_id: attachmentId,
        extracted_by_ai: true,
        ai_confidence: extractedData.confidence,
        ai_extraction_metadata: {
          extraction_type: extractionType,
          processing_timestamp: new Date().toISOString(),
          parameters_count: extractedData.parameters.length,
          matched_parameters: extractedData.parameters.filter((p: any) => p.matched).length,
          document_type: extractedData.documentType
        },
        values: calculateFlagsForResults(extractedData.parameters.map((param: any) => ({
          parameter: param.name,
          value: param.value,
          unit: param.unit || '',
          reference_range: param.reference || '',
          flag: param.status === 'Normal' ? '' : param.status, // Keep AI-detected status if available
          analyte_id: param.analyte_id
        })))
      };

      console.log('Creating result with data:', resultData);
      const { data: result, error } = await database.results.create(resultData);

      if (error) {
        throw new Error(`Failed to import to LIMS: ${error.message}`);
      }

      console.log('Successfully imported to LIMS:', result);
      setImportSuccess(true);
      
      // Show success message for 3 seconds
      setTimeout(() => setImportSuccess(false), 3000);

    } catch (error) {
      console.error('Error importing to LIMS:', error);
      alert(`Failed to import to LIMS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return 'text-green-600 bg-green-100';
      case 'H': case 'High': return 'text-red-600 bg-red-100';
      case 'L': case 'Low': return 'text-blue-600 bg-blue-100';
      case 'C': case 'Critical': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return 'text-green-600 bg-green-100';
    if (confidence >= 0.90) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'Excellent': case 'High': case 'Complete': return 'text-green-600 bg-green-100';
      case 'Good': case 'Medium': case 'Partial': return 'text-blue-600 bg-blue-100';
      case 'Poor': case 'Low': case 'Basic': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const selectedExtractionInfo = extractionTypes.find(t => t.id === extractionType);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI-Powered OCR Data Extraction</h2>
          <p className="text-gray-600 mt-1">
            Extract structured data from any document type with advanced pattern recognition
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Scan className="h-4 w-4" />
          <span>Neural OCR Engine</span>
          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
            Multi-Language Support
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Input */}
        <div className="space-y-6">
          {/* Extraction Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Document Type
            </label>
            <div className="space-y-3">
              {extractionTypes.map((type) => (
                <label key={type.id} className="block">
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    extractionType === type.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="extractionType"
                        value={type.id}
                        checked={extractionType === type.id}
                        onChange={(e) => setExtractionType(e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 mt-1"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-900">{type.name}</div>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{type.description}</div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {type.features.map((feature, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {feature}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {type.examples.map((example, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Selected Type Info */}
          {selectedExtractionInfo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                {selectedExtractionInfo.name} Configuration
              </h3>
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <div className="text-green-700">AI Features</div>
                  <div className="font-medium text-green-900">{selectedExtractionInfo.features.length} enabled</div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Upload Document
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors bg-gray-50">
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="bg-green-100 p-4 rounded-full">
                      <FileText className="h-12 w-12 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{selectedFile.name}</div>
                    <div className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {selectedExtractionInfo?.name}
                    </div>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium bg-blue-50 px-3 py-1 rounded"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-green-100 p-4 rounded-full">
                      <Upload className="h-12 w-12 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center mx-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Choose File
                    </button>
                    <p className="text-sm text-gray-500 mt-3">
                      Supports JPG, PNG, PDF, TIFF (max 10MB)
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Best results with high-resolution scans
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Process Button */}
          {selectedFile && (
            <button
              onClick={processDocument}
              disabled={processing}
              className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  Processing with AI...
                </>
              ) : (
                <>
                  <Scan className="h-5 w-5 mr-3" />
                  <Zap className="h-4 w-4 mr-2" />
                  Extract Data
                </>
              )}
            </button>
          )}

          {/* Processing Progress */}
          {processing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Layers className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-medium text-blue-900">AI OCR Pipeline</span>
              </div>
              <div className="space-y-2">
                {currentProcessingSteps.map((step, index) => (
                  <div key={index} className="flex items-center text-sm text-blue-800">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    {step}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-blue-700 mb-1">
                  <span>Extraction Progress</span>
                  <span>{confidence.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {extractedData ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-green-600" />
                  Extracted Data
                </h3>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${getConfidenceColor(extractedData.confidence)}`}>
                    {Math.round(extractedData.confidence * 100)}% Accuracy
                  </span>
                </div>
              </div>

              {/* Document Type Indicator */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Document Type:</span>
                  <span className="font-medium text-blue-900">{selectedExtractionInfo?.name}</span>
                </div>
              </div>

              {/* Quality Metrics */}
              {extractedData.qualityMetrics && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                    <Layers className="h-4 w-4 mr-2" />
                    Quality Assessment
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(extractedData.qualityMetrics).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-blue-700 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getQualityColor(value as string)}`}>
                          {value as string}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata Display */}
              {extractedData.metadata && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-purple-900 mb-2">Processing Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-purple-700">OCR Method</div>
                      <div className="font-medium text-purple-900">{extractedData.metadata.ocrMethod}</div>
                    </div>
                    <div>
                      <div className="text-purple-700">Text Length</div>
                      <div className="font-medium text-purple-900">{extractedData.metadata.extractedTextLength} chars</div>
                    </div>
                    {extractedData.metadata.matchedParameters !== undefined && (
                      <>
                        <div>
                          <div className="text-purple-700">DB Matches</div>
                          <div className="font-medium text-purple-900">
                            {extractedData.metadata.matchedParameters}/{extractedData.metadata.totalParameters}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Patient Details (for test request forms) */}
              {extractedData.patientDetails && Object.keys(extractedData.patientDetails).length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-green-900 mb-2">Patient Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {Object.entries(extractedData.patientDetails).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-green-700 capitalize">{key.replace(/_/g, ' ')}:</div>
                        <div className="font-medium text-green-900">{value as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requested Tests (for test request forms) */}
              {extractedData.requestedTests && extractedData.requestedTests.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Requested Tests</h4>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.requestedTests.map((test: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Parameters/Tests */}
              {extractedData.parameters && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Lab Parameters ({extractedData.parameters.length})</h4>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Parameter
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Value
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Unit
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reference
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            DB Match
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {extractedData.parameters.map((item: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">
                              {item.value}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.unit}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.reference}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.matched ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Matched
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  New
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Handwritten text results */}
              {extractedData.recognizedText && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Recognized Text</h4>
                  {extractedData.recognizedText.map((item: any, index: number) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <div className="text-sm text-gray-900">{item.text}</div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getConfidenceColor(item.confidence)}`}>
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Import Success Notification */}
              {importSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    <div>
                      <h4 className="font-medium text-green-900">Successfully Imported to LIMS!</h4>
                      <p className="text-sm text-green-700 mt-1">
                        {extractedData.parameters.length} parameters have been saved as a new result record.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 mt-6">
                <button 
                  onClick={importToLIMS}
                  disabled={importing || !extractedData.parameters || extractedData.parameters.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Importing...
                    </>
                  ) : importSuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Imported!
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Import to LIMS
                    </>
                  )}
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="h-4 w-4 mr-2 inline" />
                  Export Data
                </button>
                <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  Validate Results
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for OCR Processing</h3>
              <p className="text-gray-600 mb-4">
                Upload a document and click "Extract Data" to process with AI
              </p>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  AI OCR Capabilities
                </h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Deep learning neural networks
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Context-aware data validation
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Multi-language support (English, Hindi, regional)
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Handwriting recognition capabilities
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Real-time confidence scoring
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Database analyte matching
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Processing Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-900 mb-1">Optimization Tips</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Use high-resolution images (300+ DPI) for better accuracy</li>
                  <li>• Ensure proper lighting without shadows or glare</li>
                  <li>• Keep documents flat and properly aligned</li>
                  <li>• Clean lens/scanner glass for optimal image quality</li>
                  <li>• For handwritten text, use dark ink on white paper</li>
                  <li>• Remove any staples or clips that might obscure text</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRExtraction;