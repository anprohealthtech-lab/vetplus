# Rejected Analyte Actions - Implementation Complete

## Overview
Added functionality to handle rejected analytes in the Result Verification Console. Rejected analytes now have two options: **Edit Value** or **Send for Re-run**.

## Features Implemented

### 1. **Edit Value for Rejected Analytes**
- Inline editing mode for rejected analytes
- Allows editing:
  - Value (text input)
  - Unit (text input)
  - Reference Range (text input)
  - Flag (dropdown: Normal/High/Low/Critical)
- After editing, the analyte is automatically reset to **"pending"** status
- Verify note is updated to: "Value edited by verifier"

### 2. **Send for Re-run**
- Prompts user to add a note explaining why re-run is needed
- Resets analyte to **"pending"** status
- Clears verification timestamps and verifier info
- Adds note with prefix: `"RE-RUN REQUESTED: {user note}"`
- Sends analyte back to result entry workflow

## UI Changes

### Rejected Analyte Display
When an analyte is in **"rejected"** status, it shows:
1. Red badge: "Rejected" with X icon
2. Two action buttons below:
   - **Edit Value** (blue gradient) - Opens inline editor
   - **Send for Re-run** (orange gradient) - Requests re-run with note

### Inline Edit Mode
When editing is active:
- Value, Unit, Reference Range, and Flag become editable inputs
- Action buttons change to:
  - **Save** (blue gradient with checkmark)
  - **Cancel** (gray)
- All fields are styled with blue border focus rings

## Database Operations

### Edit Value Flow
```typescript
UPDATE result_values SET
  value = '{new_value}',
  unit = '{new_unit}',
  reference_range = '{new_range}',
  flag = '{new_flag}',
  verify_status = 'pending',
  verify_note = 'Value edited by verifier',
  verified_at = NULL,
  verified_by = NULL
WHERE id = '{analyte_id}'
```

### Send for Re-run Flow
```typescript
UPDATE result_values SET
  verify_status = 'pending',
  verify_note = 'RE-RUN REQUESTED: {user_note}',
  verified_at = NULL,
  verified_by = NULL
WHERE id = '{analyte_id}'
```

## User Workflow

### Scenario 1: Edit Rejected Value
1. Verifier rejects an analyte with incorrect value
2. Analyte shows "Rejected" status with note
3. Click **"Edit Value"** button
4. Modify value, unit, reference range, or flag inline
5. Click **"Save"**
6. Analyte resets to "pending" and can be re-verified

### Scenario 2: Request Re-run
1. Verifier rejects an analyte that needs lab re-testing
2. Click **"Send for Re-run"** button
3. Enter note (e.g., "Hemolyzed sample - please retest")
4. Analyte resets to "pending" with re-run note
5. Lab technician sees note in result entry screen
6. Re-test is performed and new value entered
7. Analyte goes back to verification queue

## Benefits

✅ **Flexibility**: Verifiers can correct simple errors without full re-run
✅ **Clear Communication**: Re-run notes explain why test needs repeating
✅ **Workflow Continuity**: Rejected analytes don't get stuck - they return to entry/verification
✅ **Audit Trail**: Verification notes track edit history and re-run requests
✅ **Time Saving**: Minor corrections done instantly without lab intervention

## Files Modified

### `src/pages/ResultVerificationConsole.tsx`
- Added `sendForRerun()` function (lines 692-719)
- Added `editingAnalyteId` state
- Added `editValues` state
- Added `startEditAnalyte()` function (lines 721-730)
- Added `cancelEditAnalyte()` function (lines 732-735)
- Added `saveEditedAnalyte()` function (lines 737-771)
- Updated `AnalyteRowView` component to show edit/re-run UI for rejected status (lines 989-1248)

## Technical Notes

- Edit mode is tracked by `editingAnalyteId` state (only one analyte can be edited at a time)
- `editValues` state holds temporary values during editing
- Both actions reset `verified_at` and `verified_by` to NULL
- Both actions reset status to `"pending"` to re-enter verification workflow
- UI uses Tailwind gradients for visual distinction between actions
- Loading state shows spinner during database updates

## Future Enhancements (Optional)

- [ ] Add confirmation dialog before sending for re-run
- [ ] Show re-run history/count for analytes
- [ ] Email notification to lab technician when re-run is requested
- [ ] Bulk edit mode for multiple rejected analytes
- [ ] Revision history modal showing all edits/rejections for an analyte
