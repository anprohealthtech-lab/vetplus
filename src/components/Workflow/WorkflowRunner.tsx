import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import { submitWorkflowResults } from '../../utils/workflowAPI'
import { supabase } from '../../utils/supabase'
import { uploadFile, generateFilePath } from '../../utils/supabase'
import 'survey-core/defaultV2.min.css'

interface WorkflowRunnerProps {
  workflowDefinition: any
  onComplete?: (results: any) => void
  orderId?: string
  testGroupId?: string
  patientId?: string
  labId?: string
  instanceId?: string
  workflowVersionId?: string
  workflowMapId?: string
}

interface WorkflowAttachmentRecord {
  attachment_id: string
  file_url: string | null
  file_path: string
  file_name: string
  file_type: string
  question_id: string
  uploaded_at: string
  metadata?: any
}

type WorkflowStatus = 'idle' | 'loading' | 'running' | 'completed' | 'error'

const WorkflowRunner: React.FC<WorkflowRunnerProps> = ({
  workflowDefinition,
  onComplete,
  orderId,
  testGroupId,
  patientId,
  labId,
  instanceId: providedInstanceId,
  workflowVersionId,
  workflowMapId
}) => {
  const [survey, setSurvey] = useState<Model | null>(null)
  const [status, setStatus] = useState<WorkflowStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instanceId] = useState(() => providedInstanceId || crypto.randomUUID())
  const attachmentsRef = useRef<Record<string, WorkflowAttachmentRecord[]>>({})

  // Initialize Survey.js model when workflow definition changes
  useEffect(() => {
    if (!workflowDefinition) return

    try {
      setStatus('loading')
      
      // Create survey model from workflow definition
      const surveyModel = new Model(workflowDefinition.ui?.template || workflowDefinition)
      
      // Configure survey appearance and behavior
      surveyModel.applyTheme({
        colorPalette: 'light',
        isPanelless: false
      })

      // CRITICAL: Configure all file upload questions to NOT store base64
      // This ensures files are uploaded to storage via onUploadFiles handler
      surveyModel.getAllQuestions().forEach((question: any) => {
        if (question.getType() === 'file') {
          question.storeDataAsText = false // Force upload handler usage
          console.log(`Configured file question "${question.name}" to use upload handler (storeDataAsText=false)`)
        }
      })

      // Set up completion handler
      surveyModel.onComplete.add(handleComplete)
      
      setSurvey(surveyModel)
      setStatus('running')
      setError(null)
      
    } catch (err) {
      console.error('Error initializing workflow:', err)
      setError('Failed to initialize workflow')
      setStatus('error')
    }
  }, [workflowDefinition])

  // Handle file uploads for workflow questions
  useEffect(() => {
    if (!survey || !instanceId) {
      return
    }

    const handleUploadFiles = async (_: Model, options: any) => {
      // Check required context
      if (!labId || !orderId || !patientId) {
        console.error('Missing required context for workflow file upload:', {
          labId,
          orderId,
          patientId,
          hasLabId: !!labId,
          hasOrderId: !!orderId,
          hasPatientId: !!patientId
        })
        
        // Provide helpful error message to user
        alert('Cannot upload files: Missing patient or order context. Please ensure the workflow is properly initialized with patient and order information.')
        options.callback('error')
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const uploadedBy = user?.id ?? null
        const questionName = options.question?.name as string | undefined

        console.log('Starting file upload for workflow:', {
          questionName,
          fileCount: options.files?.length || 0,
          instanceId,
          orderId,
          patientId,
          labId
        })

        const uploadedPayload = []
        const attachmentRecords: WorkflowAttachmentRecord[] = []

        for (const file of options.files ?? []) {
          console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type)
          
          const filePath = generateFilePath(file.name, patientId, labId, 'workflow')
          const { path, publicUrl } = await uploadFile(file, filePath, { upsert: false })

          console.log('File uploaded to storage:', { path, publicUrl })

          const { data: attachment, error: attachmentError } = await supabase
            .from('attachments')
            .insert({
              related_table: 'order_workflow_instances',
              related_id: instanceId,
              order_id: orderId,
              patient_id: patientId,
              lab_id: labId,
              uploaded_by: uploadedBy,
              file_path: path,
              file_url: publicUrl,
              original_filename: file.name,
              file_type: file.type,
              file_size: file.size,
              description: `Workflow upload for ${questionName ?? 'workflow'}`,
              metadata: JSON.stringify({
                question_id: questionName,
                workflow_version_id: workflowVersionId,
                workflow_map_id: workflowMapId,
                test_group_id: testGroupId,
              }),
            })
            .select()
            .single()

          if (attachmentError || !attachment) {
            console.error('Failed to create attachment record:', attachmentError)
            throw attachmentError ?? new Error('Failed to save attachment record')
          }

          console.log('Attachment record created:', attachment.id)

          const attachmentRecord: WorkflowAttachmentRecord = {
            attachment_id: attachment.id,
            file_url: attachment.file_url,
            file_path: attachment.file_path,
            file_name: attachment.original_filename,
            file_type: attachment.file_type,
            question_id: questionName ?? 'workflow_upload',
            uploaded_at: attachment.created_at ?? new Date().toISOString(),
            metadata: attachment.metadata ?? undefined,
          }

          attachmentRecords.push(attachmentRecord)

          // Survey.js expects this specific format in the callback
          uploadedPayload.push({
            file: file,
            content: publicUrl,
            name: file.name,
            type: file.type,
          })
        }

        // Store attachment records for later reference
        if (questionName) {
          const existing = attachmentsRef.current[questionName] ?? []
          attachmentsRef.current[questionName] = [...existing, ...attachmentRecords]
        }

        console.log('File upload completed successfully:', uploadedPayload.length, 'files')
        options.callback('success', uploadedPayload)
      } catch (uploadError) {
        console.error('Workflow file upload failed:', uploadError)
        alert(`File upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`)
        options.callback('error')
      }
    }

    survey.onUploadFiles.add(handleUploadFiles)

    return () => {
      survey.onUploadFiles.remove(handleUploadFiles)
    }
  }, [survey, instanceId, labId, orderId, patientId, workflowVersionId, workflowMapId, testGroupId])

  // Handle workflow completion
  const handleComplete = useCallback(async (sender: any) => {
    try {
      setIsSubmitting(true)
      
      const surveyResults = sender.data
      
      // Submit results using the API
      await submitWorkflowResults({
        workflowInstanceId: instanceId,
        stepId: 'final_results',
        results: {
          ...surveyResults,
          test_name: workflowDefinition?.title || workflowDefinition?.meta?.title || 'Workflow Test',
          patient_id: orderId,
          patient_name: 'Test Patient'
        },
        orderId,
        testGroupId
      })
      
      setStatus('completed')
      onComplete?.(surveyResults)
      
    } catch (error) {
      console.error('Error submitting workflow results:', error)
      setError(error instanceof Error ? error.message : 'Failed to submit results')
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }, [instanceId, orderId, testGroupId, onComplete, workflowDefinition])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (survey) {
        survey.onComplete.clear()
      }
    }
  }, [survey])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
          {status === 'loading' ? 'Loading workflow...' : 'Initializing...'}
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center text-red-600 mb-4">
          <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="font-semibold">Workflow Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setStatus('idle')
            setError(null)
          }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Retry
        </button>
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center text-green-600 mb-4">
          <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <h3 className="text-lg font-semibold">Workflow Completed Successfully</h3>
        </div>
        <p className="text-sm text-gray-600">
          Your workflow has been completed and results have been saved.
        </p>
        <button 
          onClick={() => {
            setStatus('idle')
            setSurvey(null)
          }}
          className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Run Again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold">
          {workflowDefinition?.title || workflowDefinition?.meta?.title || 'Workflow'}
        </h3>
        {workflowDefinition?.description && (
          <p className="text-sm text-gray-600 mt-1">{workflowDefinition.description}</p>
        )}
      </div>
      
      <div className="p-6">
        {isSubmitting && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm">Submitting workflow results...</span>
            </div>
          </div>
        )}
        
        {survey && <Survey model={survey} />}
      </div>
    </div>
  )
}

export default WorkflowRunner