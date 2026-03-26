import React, { useState, useRef } from 'react';
import { Zap, Camera, BarChart3, CheckCircle, AlertTriangle, Target, Layers, Settings, Upload, FileText, RotateCcw, User, Palette } from 'lucide-react';
import { database, supabase, uploadFile, generateFilePath } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Patient {
  id: string;
  name: string;
  emergency_phone?: string;
  blood_group?: string;
  allergies?: string;
}

const PipetteValidation: React.FC = () => {
  const { user } = useAuth();
  const [selectedPipette, setSelectedPipette] = useState('1000ul');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [calibrationData, setCalibrationData] = useState<any[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Patient selection state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Load patients on component mount
  React.useEffect(() => {
    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        const { data, error } = await database.patients.getAll();
        if (error) {
          console.error('Error loading patients:', error);
          setPatients([]);
        } else {
          setPatients(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
        setPatients([]);
      } finally {
        setLoadingPatients(false);
      }
    };

    fetchPatients();
  }, []);

  // Handle patient selection
  const handlePatientSelection = (patientId: string) => {
    setSelectedPatientId(patientId);
    const patient = patients.find(p => p.id === patientId);
    setSelectedPatient(patient || null);
  };

  const pipetteTypes = [
    { 
      id: '1000ul', 
      name: '1000μL Pipette', 
      range: '100-1000μL',
      tolerance: '±1.0%',
      manufacturer: 'Brand A',
      lastCalibration: '2024-01-01'
    },
    { 
      id: '200ul', 
      name: '200μL Pipette', 
      range: '20-200μL',
      tolerance: '±1.5%',
      manufacturer: 'Brand B',
      lastCalibration: '2024-01-10'
    },
    { 
      id: '20ul', 
      name: '20μL Pipette', 
      range: '2-20μL',
      tolerance: '±2.0%',
      manufacturer: 'Brand A',
      lastCalibration: '2024-01-05'
    },
    { 
      id: '10ul', 
      name: '10μL Pipette', 
      range: '1-10μL',
      tolerance: '±3.0%',
      manufacturer: 'Brand C',
      lastCalibration: '2023-12-20'
    },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPipetteFile(file);
    }
  };
  
  const uploadPipetteFile = async (file: File) => {
    try {
      // Generate file path for pipette validation
      const filePath = generateFilePath(
        file.name, 
        selectedPatientId || undefined, 
        undefined, 
        'pipette-validation'
      );
      
      // Upload to Supabase Storage
      const uploadResult = await uploadFile(file, filePath);
      
      // Get current user's lab_id
      const currentLabId = await database.getCurrentUserLabId();
      
      // Insert attachment record
      const { data: attachment, error } = await supabase
        .from('attachments')
        .insert([{
          patient_id: selectedPatientId || null,
          lab_id: currentLabId,
          related_table: 'pipette_validation',
          related_id: null,
          file_url: uploadResult.publicUrl,
          file_path: uploadResult.path,
          original_filename: file.name,
          stored_filename: filePath.split('/').pop(),
          file_type: file.type,
          file_size: file.size,
          description: `Pipette validation image for ${selectedPipette}`,
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
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);
      } else {
        setSelectedImage(null);
      }
      
      // Reset previous results
      setCalibrationData([]);
      setValidationProgress(0);
      setCurrentStep('');
      
    } catch (error) {
      console.error('Error uploading pipette file:', error);
      alert('Failed to upload file. Please try again.');
    }
  };

  const resetValidation = () => {
    setSelectedFile(null);
    setSelectedImage(null);
    setAttachmentId(null);
    setCalibrationData([]);
    setValidationProgress(0);
    setCurrentStep('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startValidation = async () => {
    if (!selectedFile) return;
    
    setValidating(true);
    setCurrentStep('Calling vision-ocr Edge Function...');
    setValidationProgress(0);
    
    try {
      // Convert file to base64 for API call
      const getBase64FromFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data URL prefix
          };
          reader.readAsDataURL(file);
        });
      };
      
      const base64Image = await getBase64FromFile(selectedFile);
      const pipetteInfo = pipetteTypes.find(p => p.id === selectedPipette);
      
      // Step 1: Call vision-ocr Edge Function for image analysis
      setCurrentStep('Analyzing image with Google Vision AI...');
      setValidationProgress(25);
      
      const visionResponse = await supabase.functions.invoke('vision-ocr', {
        body: {
          base64Image,
          testType: 'pipette-validation',
          analysisType: 'colors'
        }
      });
      
      if (visionResponse.error) {
        throw new Error(`Vision analysis failed: ${visionResponse.error.message}`);
      }
      
      const visionData = visionResponse.data;
      console.log('Vision analysis completed:', visionData);
      
      // Step 2: Call gemini-nlp Edge Function for validation
      setCurrentStep('Processing validation with Gemini AI...');
      setValidationProgress(50);
      
      const geminiResponse = await supabase.functions.invoke('gemini-nlp', {
        body: {
          visionResults: visionData,
          testType: 'pipette-validation',
          originalBase64Image: visionData.originalBase64Image,
          base64Image,
          pipetteDetails: pipetteInfo,
          expectedColor: null // Color assignment moved to order level
        }
      });
      
      if (geminiResponse.error) {
        throw new Error(`Gemini validation failed: ${geminiResponse.error.message}`);
      }
      
      const data = geminiResponse.data;
      
      setCurrentStep('Validation complete.');
      setValidationProgress(100);
      
      // Assuming Gemini returns an array of calibration data or a single result
      // Adjust this parsing based on your actual Gemini output structure
      if (data.calibrationData && Array.isArray(data.calibrationData)) {
        setCalibrationData(data.calibrationData);
      } else if (data.volume && data.accuracy) {
        // If Gemini returns a single result, format it into an array
        setCalibrationData([{
          volume: data.volume,
          measured: data.measuredVolume || data.volume, // Assuming measuredVolume if available
          accuracy: data.accuracy,
          precision: data.precision || 0, // Assuming precision if available
          date: new Date().toISOString().split('T')[0],
          status: data.passFailStatus || (data.accuracy >= 95 ? 'Pass' : 'Fail'), // Simple pass/fail based on accuracy
          imageQuality: data.imageQuality || 'Good',
          liquidLevel: data.meniscusVisibility || 'Clear detection'
        }]);
      } else {
        // Fallback for raw text or unexpected format
        setCalibrationData([{
          volume: 0, measured: 0, accuracy: 0, precision: 0, date: new Date().toISOString().split('T')[0],
          status: 'Fail', imageQuality: 'Poor', liquidLevel: data.rawText || 'Unexpected AI response'
        }]);
      }
      
      setCurrentStep('Validation complete.');
      setValidationProgress(100);

    } catch (error) {
      console.error('Error during AI validation:', error);
      setCurrentStep('Error: ' + error.message);
      setCalibrationData([]);
      setValidationProgress(0);
    } finally {
      setValidating(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'Pass' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 99) return 'text-green-600';
    if (accuracy >= 95) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'Excellent': return 'text-green-600 bg-green-100';
      case 'Good': return 'text-blue-600 bg-blue-100';
      case 'Poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const selectedPipetteInfo = pipetteTypes.find(p => p.id === selectedPipette);
  const passedTests = calibrationData.filter(d => d.status === 'Pass').length;
  const avgAccuracy = calibrationData.length > 0 
    ? (calibrationData.reduce((sum, d) => sum + d.accuracy, 0) / calibrationData.length).toFixed(1)
    : '0';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI-Powered Pipette Validation</h2>
          <p className="text-gray-600 mt-1">
            Upload images or videos of your pipetting process for AI-powered accuracy validation
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <BarChart3 className="h-4 w-4" />
            <span>Real-time Analysis</span>
            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
              ISO 8655 Compliant
            </div>
          </div>
          <button
            onClick={resetValidation}
            className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Validation Setup */}
        <div className="space-y-6">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Patient for Validation
            </label>
            <div className="space-y-4">
              {loadingPatients ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                  Loading patients...
                </div>
              ) : (
                <select
                  value={selectedPatientId}
                  onChange={(e) => handlePatientSelection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a patient</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} - {patient.id}
                    </option>
                  ))}
                </select>
              )}
              
              {/* Selected Patient Info Display */}
              {selectedPatient && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-purple-900 mb-3 flex items-center">
                    <Palette className="h-4 w-4 mr-2" />
                    Selected Patient
                  </h4>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="text-sm text-purple-700">Patient Information</div>
                      <div className="font-medium text-purple-900">{selectedPatient.name}</div>
                      <div className="text-xs text-purple-600">ID: {selectedPatient.id}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-white border border-purple-200 rounded text-xs text-purple-800">
                    <strong>Note:</strong> Color validation will be handled at the order level when tests are requested.
                  </div>
                </div>
              )}
              
              {/* Patient Info Display */}
              {selectedPatient && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Selected Patient</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <div><strong>Name:</strong> {selectedPatient.name}</div>
                    <div><strong>ID:</strong> {selectedPatient.id}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analyte Instructions Placeholder */}
          {selectedPatient && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-900 mb-2 flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Machine-Specific Instructions
              </h4>
              <div className="text-sm text-yellow-800">
                <div className="mb-2">
                  <strong>Patient:</strong> {selectedPatient.name}
                </div>
                <div className="bg-white border border-yellow-200 rounded p-2 text-xs">
                  <em>Analyte-specific instructions will be displayed here based on the patient's active test orders and machine configuration. This feature will be implemented in a future phase.</em>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Upload Pipetting Image/Video
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors bg-gray-50">
              {selectedFile ? (
                <div className="space-y-4">
                  {selectedImage ? (
                    <div className="relative">
                      <img
                        src={selectedImage}
                        alt="Pipetting validation"
                        className="max-w-full h-48 object-contain mx-auto rounded-lg border border-gray-200 shadow-sm"
                      />
                      {validating && (
                        <div className="absolute inset-0 bg-purple-600 bg-opacity-20 rounded-lg flex items-center justify-center">
                          <div className="bg-white rounded-full p-3 shadow-lg">
                            <Camera className="h-8 w-8 text-purple-600 animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <div className="bg-purple-100 p-4 rounded-full">
                        <FileText className="h-12 w-12 text-purple-500" />
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">{selectedFile.name}</div>
                    <div className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {selectedFile.type.startsWith('image/') ? 'Image' : 'Video'}
                    </div>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium bg-purple-50 px-3 py-1 rounded"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-purple-100 p-4 rounded-full">
                      <Upload className="h-12 w-12 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center mx-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Choose File
                    </button>
                    <p className="text-sm text-gray-500 mt-3">
                      Supports JPG, PNG, MP4, MOV (max 50MB)
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Best results with clear, well-lit images/videos
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Pipette Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Pipette for Validation
            </label>
            <div className="grid grid-cols-1 gap-3">
              {pipetteTypes.map((pipette) => (
                <label key={pipette.id} className={'flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all ' + 
                  (selectedPipette === pipette.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200')
                }>
                  <input
                    type="radio"
                    name="pipette"
                    value={pipette.id}
                    checked={selectedPipette === pipette.id}
                    onChange={(e) => setSelectedPipette(e.target.value)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">{pipette.name}</div>
                      <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {pipette.tolerance}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Range: {pipette.range} • {pipette.manufacturer}
                    </div>
                    <div className="text-xs text-gray-400">
                      Last calibration: {new Date(pipette.lastCalibration).toLocaleDateString()}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Selected Pipette Info */}
          {selectedPipetteInfo && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                {selectedPipetteInfo.name} Specifications
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-purple-700">Volume Range</div>
                  <div className="font-medium text-purple-900">{selectedPipetteInfo.range}</div>
                </div>
                <div>
                  <div className="text-purple-700">Tolerance</div>
                  <div className="font-medium text-purple-900">{selectedPipetteInfo.tolerance}</div>
                </div>
                <div>
                  <div className="text-purple-700">Manufacturer</div>
                  <div className="font-medium text-purple-900">{selectedPipetteInfo.manufacturer}</div>
                </div>
                <div>
                  <div className="text-purple-700">Last Calibration</div>
                  <div className="font-medium text-purple-900">
                    {new Date(selectedPipetteInfo.lastCalibration).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Process */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2" />
              AI Validation Process
            </h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</div>
                <div>
                  <div className="font-medium">Prepare Colored Solution</div>
                  <div className="text-blue-700">Use methylene blue or food coloring for optimal visibility</div>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</div>
                <div>
                  <div className="font-medium">Dispense Test Volumes</div>
                  <div className="text-blue-700">Multiple volumes across the pipette range into clear tubes</div>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</div>
                <div>
                  <div className="font-medium">AI Image Analysis</div>
                  <div className="text-blue-700">Computer vision detects liquid levels and calculates volumes</div>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">4</div>
                <div>
                  <div className="font-medium">Quality Assessment</div>
                  <div className="text-blue-700">Real-time validation against ISO 8655 standards</div>
                </div>
              </div>
            </div>
          </div>

          {/* Start Validation */}
          <button
            onClick={startValidation}
            disabled={validating || !selectedFile || !selectedPatientId}
            className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {validating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                Running AI Validation...
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 mr-3" />
                <Zap className="h-4 w-4 mr-2" />
                Start AI Validation
              </>
            )}
          </button>

          {/* File Requirements Notice */}
          {(!selectedFile || !selectedPatientId) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 mb-1">Requirements</h4>
                  <p className="text-sm text-yellow-800">
                    {!selectedPatientId && "Please select a patient for validation. "}
                    {!selectedFile && "Please upload an image or video of your pipetting process to begin AI validation."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation Progress */}
          {validating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Layers className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-medium text-blue-900">AI Processing Pipeline</span>
              </div>
              <div className="space-y-3">
                <div className="text-sm text-blue-800">
                  {currentStep}
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: validationProgress + '%' }}
                  />
                </div>
                <div className="flex justify-between text-sm text-blue-700">
                  <span>Processing...</span>
                  <span>{validationProgress.toFixed(0) + '%'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {calibrationData.length > 0 ? (
            <>
              {/* Validation Summary */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Validation Results Summary
                </h3>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-600">
                      {passedTests + '/' + calibrationData.length}
                    </div>
                    <div className="text-sm text-green-600 font-medium">Tests Passed</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">
                      {avgAccuracy + '%'}
                    </div>
                    <div className="text-sm text-blue-600 font-medium">Avg Accuracy</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600">
                      {(calibrationData.reduce((sum, d) => sum + d.precision, 0) / calibrationData.length).toFixed(1) + '%'}
                    </div>
                    <div className="text-sm text-purple-600 font-medium">Avg CV</div>
                  </div>
                </div>

                {/* Detailed Results Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Target Volume
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Measured
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Accuracy
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Precision
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Quality
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {calibrationData.map((data, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {data.volume + 'μL'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {data.measured + 'μL'}
                          </td>
                          <td className={'px-4 py-3 text-sm font-medium ' + getAccuracyColor(data.accuracy)}>
                            {data.accuracy + '%'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {data.precision + '% CV'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + getStatusColor(data.status)}>
                              {data.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' + getQualityColor(data.imageQuality)}>
                              {data.imageQuality}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Analysis Details */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  AI Analysis Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-purple-700">Image Processing</div>
                    <div className="font-medium text-purple-900">Edge detection + meniscus analysis</div>
                  </div>
                  <div>
                    <div className="text-purple-700">Volume Calculation</div>
                    <div className="font-medium text-purple-900">Geometric modeling + ML correction</div>
                  </div>
                  <div>
                    <div className="text-purple-700">Quality Assessment</div>
                    <div className="font-medium text-purple-900">Real-time confidence scoring</div>
                  </div>
                  <div>
                    <div className="text-purple-700">Standards Compliance</div>
                    <div className="font-medium text-purple-900">ISO 8655-6 validation</div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-1">AI-Generated Recommendations</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {passedTests === calibrationData.length ? (
                        <>
                          <li>• Pipette performance is within acceptable tolerances</li>
                          <li>• Continue with regular quarterly validation schedule</li>
                          <li>• Document results in quality management system</li>
                        </>
                      ) : (
                        <>
                          <li>• {(calibrationData.length - passedTests) + ' test(s) failed - pipette may need servicing'}</li>
                          <li>• Consider professional calibration or maintenance</li>
                          <li>• Repeat validation after service to confirm performance</li>
                        </>
                      )}
                      <li>• Average accuracy is {avgAccuracy + '% (target: >95%)'}</li>
                      <li>• Schedule next validation in 30 days</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Save to QC Log
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Generate Certificate
                </button>
                <button className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Export Report
                </button>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Zap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for AI Validation</h3>
              <p className="text-gray-600 mb-4">
                Select your pipette type and start the AI-powered validation process
              </p>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Target className="h-4 w-4 mr-2" />
                  AI Validation Benefits
                </h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Computer vision-based volume measurement
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Real-time quality assessment and validation
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    ISO 8655 compliance reporting
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Automated documentation and trending
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Cost-effective alternative to gravimetric methods
                  </li>
                  <li>• Ensure the patient's assigned color code is visible on pipette tip or container</li>
                  <li>• Include any color-coded labels or markers in the image frame</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipetteValidation;