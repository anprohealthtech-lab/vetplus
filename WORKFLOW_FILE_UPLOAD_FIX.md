# Workflow File Upload Fix - Complete Implementation

## Problem Identified

**Issue**: When users uploaded files (images, documents) in workflows using `WorkflowRunner.tsx`, the files were being stored as base64-encoded data in the Survey.js JSON response instead of being uploaded to Supabase Storage and linked via the `attachments` table.

**Impact**:
- Large base64 strings bloating database records
- Files not accessible via proper file management system
- No attachment audit trail or metadata
- Process-workflow-results function expected `attachment_id` references but received base64 data

## Root Cause

The `WorkflowRunner.tsx` component was **missing the `onUploadFiles` handler** that Survey.js provides for intercepting file upload events. Without this handler, Survey.js defaults to converting files to base64 and storing them inline with the survey data.

Meanwhile, `SimpleWorkflowRunner.tsx` **already had proper file upload handling** implemented, uploading files to storage and creating attachment records.

## Solution Implemented

### 1. Enhanced WorkflowRunner.tsx

Added comprehensive file upload handling to match `SimpleWorkflowRunner`:

**New Interfaces:**
```typescript
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
```

**Additional Props:**
```typescript
interface WorkflowRunnerProps {
  workflowDefinition: any
  onComplete?: (results: any) => void
  orderId?: string
  testGroupId?: string
  patientId?: string          // NEW - Required for file paths
  labId?: string              // NEW - Required for file organization
  instanceId?: string         // NEW - For linking attachments
  workflowVersionId?: string  // NEW - For metadata
  workflowMapId?: string      // NEW - For metadata
}
```

**File Upload Handler:**
```typescript
useEffect(() => {
  if (!survey || !instanceId) return

  const handleUploadFiles = async (_: Model, options: any) => {
    // 1. Upload files to Supabase Storage using organized paths
    // 2. Create attachment records in database
    // 3. Link attachments to workflow instance
    // 4. Update survey values with attachment_id references (not base64)
    // 5. Return success with file URLs
  }

  survey.onUploadFiles.add(handleUploadFiles)
  return () => survey.onUploadFiles.remove(handleUploadFiles)
}, [survey, instanceId, labId, orderId, patientId, workflowVersionId, workflowMapId, testGroupId])
```

### 2. Updated FlowManager.tsx

Enhanced to pass required props to WorkflowRunner:

**New Props:**
```typescript
interface FlowManagerProps {
  orderId: string
  testGroupId: string
  analyteIds: string[]
  labId: string
  patientId?: string  // NEW - Pass through from parent
  onComplete: (results: any) => void
  className?: string
}
```

**WorkflowRunner Invocation:**
```typescript
<WorkflowRunner
  orderId={orderId}
  patientId={patientId}              // NEW
  labId={labId}                      // NEW
  testGroupId={testGroupId}          // NEW
  instanceId={currentFlowData.instanceId}        // NEW
  workflowVersionId={currentFlowData.workflowVersionId}  // NEW
  workflowDefinition={currentFlowData.definition}
  onComplete={(results) => handleFlowComplete(currentFlow, results)}
/>
```

### 3. Updated WorkflowPanel.tsx

Added `patientId` to FlowManager call:

```typescript
<FlowManager
  orderId={order.id}
  patientId={order.patient_id}  // NEW - From order object
  testGroupId={testGroup.id}
  analyteIds={testGroup.analytes?.map(a => a.id) || []}
  labId={order.lab_id}
  onComplete={handleWorkflowComplete}
/>
```

## Technical Details

### File Upload Flow

1. **User selects file in Survey.js form**
   - Survey.js triggers `onUploadFiles` event

2. **handleUploadFiles intercepts the event**
   - Validates required context (labId, orderId, patientId)
   - Iterates through uploaded files

3. **For each file:**
   - Generate organized file path: `{labId}/workflow/{patientId}/{timestamp}_{filename}`
   - Upload to Supabase Storage bucket
   - Get public URL and storage path

4. **Create attachment record:**
   ```typescript
   {
     related_table: 'order_workflow_instances',
     related_id: instanceId,
     order_id: orderId,
     patient_id: patientId,
     lab_id: labId,
     uploaded_by: user.id,
     file_path: path,
     file_url: publicUrl,
     original_filename: file.name,
     file_type: file.type,
     file_size: file.size,
     description: `Workflow upload for ${questionName}`,
     metadata: JSON.stringify({
       question_id: questionName,
       workflow_version_id: workflowVersionId,
       workflow_map_id: workflowMapId,
       test_group_id: testGroupId,
     })
   }
   ```

5. **Update survey value:**
   - Replace file object with attachment reference:
   ```typescript
   {
     attachment_id: attachment.id,
     url: publicUrl,
     file_name: file.name,
     file_type: file.type,
     uploaded_at: timestamp
   }
   ```

6. **Survey completion:**
   - Survey data contains `attachment_id` references (not base64)
   - Compatible with `process-workflow-results` function expectations

### Database Schema Used

**Attachments Table:**
- Generic relationship: `related_table` + `related_id`
- Links to: `order_workflow_instances`
- Contains: file paths, URLs, metadata
- Indexed by: order_id, patient_id, lab_id

**Result Values Table:**
- Already expects `sample_id` (fixed separately to handle null)
- Compatible with attachment references in workflow results

## Benefits

1. **Proper File Management**
   - Files stored in organized bucket structure
   - Accessible via CDN/public URLs
   - Proper file metadata and audit trail

2. **Database Efficiency**
   - No large base64 blobs in workflow_step_events
   - Normalized data with attachment references
   - Efficient queries and indexing

3. **Consistent Architecture**
   - WorkflowRunner now matches SimpleWorkflowRunner behavior
   - Standardized attachment handling across all workflow types
   - process-workflow-results receives expected data format

4. **Enhanced Features**
   - Attachment versioning possible
   - File access control via RLS
   - Searchable attachment metadata
   - Workflow-to-attachment linkage

## Testing Recommendations

1. **File Upload in WorkflowRunner:**
   - Test image capture via camera
   - Test document upload
   - Test multiple files per question
   - Verify files appear in Storage bucket
   - Verify attachment records created

2. **Result Processing:**
   - Complete workflow with file uploads
   - Trigger process-workflow-results
   - Verify extractImageAttachments finds attachment_id references
   - Verify no base64 data in workflow_step_events

3. **Edge Cases:**
   - Missing patientId/labId (should error gracefully)
   - Upload failure (should show error to user)
   - Large files (check size limits)
   - Multiple sequential uploads

## Related Files Modified

1. **src/components/Workflow/WorkflowRunner.tsx**
   - Added file upload handler
   - Added new props and interfaces
   - Added attachments ref tracking

2. **src/components/Workflow/FlowManager.tsx**
   - Added patientId prop
   - Passed all required props to WorkflowRunner

3. **src/components/Results/EntryMode/WorkflowPanel.tsx**
   - Added patientId to FlowManager call

4. **supabase/functions/process-workflow-results/index.ts** (Previous fix)
   - Made sample_id nullable to handle missing samples
   - Already expects attachment_id references (now receives them correctly)

## Future Enhancements

1. **File Preview:** Show uploaded files in workflow UI
2. **File Validation:** Restrict file types/sizes per question
3. **Progress Tracking:** Show upload progress for large files
4. **Attachment Gallery:** View all workflow attachments in one place
5. **OCR Integration:** Automatically process uploaded images with vision-ocr function

## Deployment Notes

- Changes are backward compatible (old workflows without files still work)
- Requires proper Supabase Storage bucket permissions
- RLS policies on attachments table should allow workflow uploads
- No database migrations needed (uses existing schema)

## Summary

This fix ensures that **all workflow file uploads** are properly handled across the entire LIMS system, maintaining data integrity, enabling proper file management, and ensuring compatibility with AI processing workflows that expect structured attachment references rather than inline base64 data.
