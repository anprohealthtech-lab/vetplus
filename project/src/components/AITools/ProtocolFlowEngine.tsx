import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Clock, 
  Camera,
  FileText,
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface ProtocolStep {
  id: string;
  step_order: number;
  step_type: 'capture' | 'timer' | 'instruction' | 'analysis' | 'validation';
  title: string;
  description: string;
  config: any;
  is_required: boolean;
  estimated_duration_seconds: number;
}

interface ProtocolFlowEngineProps {
  protocol: any;
  session: any;
  onComplete: (results: any) => void;
  onCancel: () => void;
}

const ProtocolFlowEngine: React.FC<ProtocolFlowEngineProps> = ({
  protocol,
  session,
  onComplete,
  onCancel
}) => {
  const [steps, setSteps] = useState<ProtocolStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionData, setSessionData] = useState<any>({});
  const [stepStatus, setStepStatus] = useState<Record<number, 'pending' | 'active' | 'completed' | 'skipped'>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Timer state
  const [timerActive, setTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Capture state
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [captureInput, setCaptureInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProtocolSteps();
  }, [protocol.id]);

  useEffect(() => {
    // Initialize step status
    const initialStatus: Record<number, 'pending' | 'active' | 'completed' | 'skipped'> = {};
    steps.forEach((_, index) => {
      initialStatus[index] = index === 0 ? 'active' : 'pending';
    });
    setStepStatus(initialStatus);
  }, [steps]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  const loadProtocolSteps = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_protocol_steps')
        .select('*')
        .eq('protocol_id', protocol.id)
        .order('step_order', { ascending: true });

      if (error) throw error;
      setSteps(data || []);
    } catch (error) {
      console.error('Error loading protocol steps:', error);
    }
  };

  const currentStep = steps[currentStepIndex];

  const startTimer = (duration: number) => {
    setTimeRemaining(duration);
    setTimerActive(true);
    
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setTimerInterval(interval);
  };

  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setTimerActive(false);
  };

  const resetTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setTimerActive(false);
    setTimeRemaining(currentStep?.config?.timer_duration || 0);
  };

  const handleFileCapture = (files: FileList | null) => {
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setCapturedFiles([...capturedFiles, ...newFiles]);
    }
  };

  const processCapture = async (stepData: any) => {
    try {
      setIsProcessing(true);

      // Create capture record
      const captureData = {
        session_id: session.id,
        step_id: currentStep.id,
        capture_type: currentStep.config.capture_type || 'unknown',
        capture_metadata: stepData,
        analysis_status: 'pending'
      };

      // If files were captured, handle file upload
      if (capturedFiles.length > 0) {
        // In a real implementation, you'd upload files to storage
        // For now, we'll just record the file metadata
        captureData.capture_metadata = {
          ...stepData,
          file_count: capturedFiles.length,
          file_names: capturedFiles.map(f => f.name)
        };
      }

      const { data: capture, error } = await supabase
        .from('ai_captures')
        .insert(captureData)
        .select()
        .single();

      if (error) throw error;

      // If this step requires AI analysis, trigger it
      if (currentStep.step_type === 'analysis' || currentStep.config.ai_service) {
        await triggerAIAnalysis(capture.id);
      }

      return capture;
    } catch (error) {
      console.error('Error processing capture:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerAIAnalysis = async (captureId: string) => {
    try {
      // Update capture status to processing
      await supabase
        .from('ai_captures')
        .update({ analysis_status: 'processing' })
        .eq('id', captureId);

      // In a real implementation, this would call your AI service
      // For demo purposes, we'll simulate processing
      setTimeout(async () => {
        const mockResults = {
          confidence: 0.95,
          extracted_data: { 
            sample: 'Demo results',
            analysis_complete: true 
          }
        };

        await supabase
          .from('ai_captures')
          .update({ 
            analysis_status: 'completed',
            analysis_results: mockResults,
            confidence_score: mockResults.confidence,
            processed_at: new Date().toISOString()
          })
          .eq('id', captureId);
      }, 2000);

    } catch (error) {
      console.error('Error triggering AI analysis:', error);
    }
  };

  const completeCurrentStep = async () => {
    try {
      setIsProcessing(true);

      let stepData: any = {};

      // Collect step-specific data
      switch (currentStep.step_type) {
        case 'timer':
          stepData = {
            timer_completed: timeRemaining === 0,
            actual_duration: (currentStep.config.timer_duration || 0) - timeRemaining
          };
          break;
        case 'capture':
          if (currentStep.config.capture_type === 'numerical') {
            stepData = { value: parseFloat(captureInput) };
          } else {
            stepData = { input: captureInput };
          }
          if (capturedFiles.length > 0) {
            await processCapture(stepData);
          }
          break;
        case 'instruction':
          stepData = { acknowledged: true };
          break;
        case 'analysis':
          stepData = { analysis_requested: true };
          break;
        case 'validation':
          stepData = { validated: true, input: captureInput };
          break;
      }

      // Update session data
      const newSessionData = {
        ...sessionData,
        [`step_${currentStep.step_order}`]: stepData
      };
      setSessionData(newSessionData);

      // Update session in database
      await supabase
        .from('ai_protocol_sessions')
        .update({
          current_step_order: currentStep.step_order + 1,
          session_data: newSessionData
        })
        .eq('id', session.id);

      // Mark current step as completed
      setStepStatus(prev => ({
        ...prev,
        [currentStepIndex]: 'completed'
      }));

      // Move to next step or complete
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setStepStatus(prev => ({
          ...prev,
          [currentStepIndex + 1]: 'active'
        }));
        
        // Reset step-specific state
        setCaptureInput('');
        setCapturedFiles([]);
        resetTimer();
      } else {
        // Protocol completed
        onComplete(newSessionData);
      }

    } catch (error) {
      console.error('Error completing step:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setStepStatus(prev => ({
        ...prev,
        [currentStepIndex]: 'pending',
        [currentStepIndex - 1]: 'active'
      }));
      setCurrentStepIndex(currentStepIndex - 1);
      resetTimer();
    }
  };

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'capture':
        return <Camera className="h-5 w-5" />;
      case 'timer':
        return <Clock className="h-5 w-5" />;
      case 'instruction':
        return <FileText className="h-5 w-5" />;
      case 'analysis':
        return <AlertTriangle className="h-5 w-5" />;
      case 'validation':
        return <Check className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (steps.length === 0) {
    return <div className="flex justify-center py-8">Loading protocol steps...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps Overview */}
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full border-2 
              ${stepStatus[index] === 'completed' ? 'bg-green-500 border-green-500 text-white' :
                stepStatus[index] === 'active' ? 'bg-blue-500 border-blue-500 text-white' :
                'bg-gray-100 border-gray-300 text-gray-400'}
            `}>
              {stepStatus[index] === 'completed' ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 ${stepStatus[index] === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Current Step */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
              {getStepIcon(currentStep.step_type)}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{currentStep.title}</h3>
            <p className="text-gray-600 mb-4">{currentStep.description}</p>

            {/* Step-specific UI */}
            {currentStep.step_type === 'timer' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-blue-600">
                    {formatTime(timeRemaining)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Target: {formatTime(currentStep.config.timer_duration || 0)}
                  </div>
                </div>
                <div className="flex justify-center gap-2">
                  {!timerActive ? (
                    <button
                      onClick={() => startTimer(currentStep.config.timer_duration || 0)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Play className="h-4 w-4" />
                      Start Timer
                    </button>
                  ) : (
                    <button
                      onClick={pauseTimer}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </button>
                  )}
                  <button
                    onClick={resetTimer}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {currentStep.step_type === 'capture' && (
              <div className="space-y-4">
                {currentStep.config.capture_type === 'image' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={(e) => handleFileCapture(e.target.files)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      <Camera className="h-4 w-4" />
                      Take Photo
                    </button>
                    {capturedFiles.length > 0 && (
                      <p className="text-sm text-green-600 mt-2">
                        {capturedFiles.length} file(s) captured
                      </p>
                    )}
                  </div>
                )}

                {currentStep.config.capture_type === 'numerical' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter measurement ({currentStep.config.unit || ''})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={captureInput}
                      onChange={(e) => setCaptureInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep.step_type === 'instruction' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Instructions</h4>
                    <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
                      {currentStep.config.requirements?.map((req: string, index: number) => (
                        <li key={index}>{req.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {currentStep.step_type === 'analysis' && (
              <div className="text-center py-4">
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">AI analysis in progress...</span>
                  </div>
                ) : (
                  <p className="text-gray-600">Ready for AI analysis</p>
                )}
              </div>
            )}

            {currentStep.step_type === 'validation' && (
              <div className="space-y-4">
                <textarea
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  placeholder="Enter validation notes or corrections..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={completeCurrentStep}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : currentStepIndex === steps.length - 1 ? (
              'Complete Protocol'
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProtocolFlowEngine;
