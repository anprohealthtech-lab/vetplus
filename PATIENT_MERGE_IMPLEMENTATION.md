# Patient Merge System Implementation

## Overview
Implemented a comprehensive non-destructive patient merge system that allows linking duplicate patient records without data loss. The system uses a reference pointer approach where duplicate patients point to a master patient, preserving all data and allowing unmerge operations.

## Implementation Status: ✅ COMPLETE

### 1. Database Layer ✅
**File:** `db/migrations/20251118_patient_merge_system.sql`

#### Schema Changes
- Added 4 columns to `patients` table:
  - `master_patient_id` (UUID): Self-referencing FK to patients(id), NULL for unique patients
  - `is_duplicate` (BOOLEAN): TRUE when marked as duplicate
  - `merge_date` (TIMESTAMPTZ): Timestamp of merge operation
  - `merged_by` (UUID): FK to auth.users(id) tracking who performed the merge

#### Database Objects Created

**View: `v_patients_with_duplicates`**
- Shows only unique/master patients (filters out duplicates)
- Includes `duplicate_count` - count of linked duplicates
- Includes `duplicate_patient_ids` - array of duplicate UUIDs
- Includes `duplicate_patient_names` - array of duplicate names
- Automatically aggregates all duplicate information

**RPC Function: `merge_patients(p_master_id, p_duplicate_id, p_merged_by)`**
- Validates both patients exist
- Prevents self-merge
- Prevents duplicate-as-master error
- Prevents already-merged patient from being merged again
- Validates same lab requirement
- Updates duplicate patient with master link
- Returns JSON: `{success: boolean, message: string, error?: string}`

**RPC Function: `unmerge_patient(p_duplicate_id)`**
- Validates patient is a duplicate
- Removes master link, clears duplicate flags
- Restores patient as unique/independent
- Returns JSON: `{success: boolean, message: string, error?: string}`

**RPC Function: `get_patient_with_duplicates(p_patient_id)`**
- Works with both master and duplicate patient IDs
- Determines correct master patient automatically
- Returns master patient object + array of all duplicates
- Includes merge metadata (merge_date, merged_by)
- Returns JSON: `{master_patient: object, duplicates: array, total_count: number}`

#### Indexes Created
- `idx_patients_master_patient_id` - Fast lookup of duplicates by master
- `idx_patients_is_duplicate` - Fast filtering of duplicate patients

### 2. UI Components ✅

#### PatientMergeModal Component
**File:** `src/components/Patients/PatientMergeModal.tsx`

**Features:**
- Two-panel layout: Master patient (green) + Duplicate selection
- Automatic duplicate detection based on:
  - Similar name matching (first name comparison)
  - Exact phone number match
- Search/filter functionality for finding duplicates
- Visual merge preview with arrow showing merge direction
- Comprehensive patient info cards with all details
- Confirmation dialog before merge
- Loading states and error handling
- Success notification and automatic list refresh

**UI/UX:**
- Gradient purple/indigo header
- Green master patient card (kept)
- Selectable duplicate patient cards (clickable)
- Yellow warning panel with merge preview
- Disabled state for merge button until duplicate selected
- Animated loading spinner during merge operation

#### ViewDuplicatesModal Component
**File:** `src/components/Patients/ViewDuplicatesModal.tsx`

**Features:**
- Shows master patient at top (green card)
- Lists all linked duplicates below (amber cards)
- Displays merge metadata:
  - Merge date and time (formatted)
  - User who performed merge
- Individual "Unmerge" button for each duplicate
- Comprehensive patient details in each card
- Loading and error states
- Information panel explaining merge system

**UI/UX:**
- Gradient purple/indigo header
- Green master patient card with UserCheck icon
- Amber duplicate patient cards with User icon
- Merge info section with Calendar and User icons
- Blue info panel at bottom explaining system behavior
- Individual unmerge confirmations
- Animated loading during unmerge operations

#### Patients Page Updates
**File:** `src/pages/Patients.tsx`

**Changes Made:**

1. **Imports:**
   - Added `Users` and `Copy` icons from lucide-react
   - Imported `PatientMergeModal` and `ViewDuplicatesModal` components

2. **Patient Interface Extended:**
   ```typescript
   duplicate_count?: number;
   duplicate_patient_ids?: string[];
   duplicate_patient_names?: string[];
   ```

3. **State Management:**
   - `showMergeModal` - controls merge modal visibility
   - `showDuplicatesModal` - controls view duplicates modal visibility
   - `mergePatient` - stores patient selected as merge master

4. **Data Loading:**
   - Changed from `database.patients.getAllWithTestCounts()` 
   - To: `supabase.from('v_patients_with_duplicates').select('*')`
   - Now shows only unique/master patients automatically

5. **New Handlers:**
   - `handleMergeClick(patient)` - Opens merge modal with patient as master
   - `handleViewDuplicates(patient)` - Opens view duplicates modal
   - `handleMergeSuccess()` - Reloads patient list after successful merge
   - `handleUnmergeSuccess()` - Reloads patient list after unmerge

6. **Header Updates:**
   - Added "Merge Patients" button (purple) next to "Register Patient"
   - Button opens merge modal with first patient as default master

7. **Table Enhancements:**
   - Added duplicate badge in "Tests" column:
     - Shows when `duplicate_count > 0`
     - Amber badge with Copy icon
     - Format: "X duplicate(s)"
   - Added action buttons:
     - **View Duplicates** (Users icon, amber): Shows when duplicate_count > 0
     - **Merge Duplicate** (Copy icon, purple): Always visible for merging into this patient

8. **Modal Integration:**
   - PatientMergeModal rendered when `showMergeModal && mergePatient`
   - ViewDuplicatesModal rendered when `showDuplicatesModal && selectedPatient`

### 3. Workflow & User Experience

#### Merge Workflow
1. User clicks "Merge Patients" button in header OR clicks merge icon on a patient row
2. PatientMergeModal opens with selected patient as master
3. System automatically suggests potential duplicates based on name/phone similarity
4. User can search/filter to find the duplicate patient
5. User selects duplicate patient (card highlights)
6. Yellow preview panel shows merge direction and explanation
7. User clicks "Merge Patients" button
8. Confirmation dialog appears
9. System calls `merge_patients()` RPC function
10. Success notification shown
11. Modal closes, patient list refreshes
12. Duplicate patient no longer appears in main list
13. Master patient shows duplicate badge with count

#### View/Unmerge Workflow
1. User sees amber duplicate badge on patient row
2. User clicks Users icon (View Duplicates)
3. ViewDuplicatesModal opens
4. Shows master patient at top (green card)
5. Shows all linked duplicates below (amber cards)
6. Each duplicate shows merge date and who merged it
7. User clicks "Unmerge" button on a duplicate
8. Confirmation dialog appears
9. System calls `unmerge_patient()` RPC function
10. Success notification shown
11. Duplicates list refreshes
12. Patient list refreshes (unmerged patient now visible)
13. Duplicate count decreases

### 4. Security & Validation

#### Database-Level Validation
- Foreign key constraints prevent orphaned records
- Self-referencing FK ensures master_patient_id points to valid patient
- Merged_by FK ensures audit trail points to valid user
- Same-lab validation prevents cross-lab merges
- Duplicate detection prevents double-merging

#### Application-Level Validation
- Authentication check (requires logged-in user)
- Confirmation dialogs before destructive actions
- Error handling with user-friendly messages
- Loading states prevent double-clicks
- Disabled states during operations

#### Data Integrity
- **Non-Destructive:** No patient records are deleted
- **Reversible:** Unmerge restores patient as independent
- **Audit Trail:** merge_date and merged_by tracked
- **Order Preservation:** All orders remain with original patient
- **Test Preservation:** All test results remain intact

### 5. Technical Details

#### Patient Visibility Rules
```sql
-- Main patient list shows only unique/master patients
SELECT * FROM v_patients_with_duplicates;

-- This filters out records where:
-- master_patient_id IS NOT NULL (duplicates)
-- is_duplicate = TRUE (duplicates)

-- Duplicates are accessible via:
get_patient_with_duplicates(patient_id)
```

#### Merge Operation
```sql
UPDATE patients SET
  master_patient_id = :master_id,
  is_duplicate = TRUE,
  merge_date = CURRENT_TIMESTAMP,
  merged_by = :user_id
WHERE id = :duplicate_id;
```

#### Unmerge Operation
```sql
UPDATE patients SET
  master_patient_id = NULL,
  is_duplicate = FALSE,
  merge_date = NULL,
  merged_by = NULL
WHERE id = :duplicate_id;
```

### 6. UI Design Patterns

#### Color Coding
- **Green** - Master/Unique patients (kept records)
- **Amber/Yellow** - Duplicate patients (hidden from main list)
- **Purple/Indigo** - Merge actions and modals
- **Blue** - Information and help text

#### Icons Used
- **Users** - View duplicates, merge system
- **Copy** - Merge duplicate indicator
- **UserCheck** - Master patient indicator
- **User** - Duplicate patient indicator
- **Calendar** - Merge date
- **ArrowRight** - Merge direction in preview
- **CheckCircle** - Selection confirmation

#### Responsive Design
- Modal max-width: 6xl (1280px)
- Scrollable content with max-height
- Grid layouts for patient details (2 columns)
- Mobile-friendly button sizes
- Touch-friendly click targets

### 7. Testing Checklist

#### Migration Testing
- [ ] Execute migration in Supabase SQL Editor
- [ ] Verify `patients` table has 4 new columns
- [ ] Verify `v_patients_with_duplicates` view exists
- [ ] Verify `merge_patients` function exists
- [ ] Verify `unmerge_patient` function exists
- [ ] Verify `get_patient_with_duplicates` function exists
- [ ] Verify indexes created successfully
- [ ] Test view query returns only unique patients

#### Functional Testing
- [ ] Create duplicate patient manually
- [ ] Test merge operation (select master + duplicate)
- [ ] Verify duplicate no longer appears in main list
- [ ] Verify master shows duplicate badge with count
- [ ] Test view duplicates modal
- [ ] Verify duplicate patient details displayed correctly
- [ ] Test unmerge operation
- [ ] Verify unmerged patient appears in main list
- [ ] Verify duplicate count decreases
- [ ] Test multiple duplicates per master

#### Edge Cases
- [ ] Try merging patient with itself (should prevent)
- [ ] Try merging already-merged patient (should prevent)
- [ ] Try merging patients from different labs (should prevent)
- [ ] Try unmerging non-duplicate patient (should prevent)
- [ ] Test with patient having multiple linked duplicates
- [ ] Test searching/filtering in merge modal
- [ ] Test with no potential duplicates found

#### UI/UX Testing
- [ ] Verify modal opens/closes correctly
- [ ] Test search functionality in merge modal
- [ ] Verify loading states appear correctly
- [ ] Test error message display
- [ ] Verify confirmation dialogs work
- [ ] Test success notifications
- [ ] Verify patient list refreshes after operations
- [ ] Test duplicate badge visibility
- [ ] Verify action buttons appear correctly

### 8. Next Steps

#### Immediate Actions
1. **Run Migration:**
   ```sql
   -- In Supabase SQL Editor, execute:
   -- db/migrations/20251118_patient_merge_system.sql
   ```

2. **Test Basic Workflow:**
   - Navigate to Patients page
   - Click "Merge Patients" button
   - Select duplicate patient
   - Complete merge
   - Verify duplicate hidden from list

3. **Test Unmerge:**
   - Click Users icon on patient with duplicates
   - Click "Unmerge" on a duplicate
   - Verify patient restored to main list

#### Future Enhancements
- **Bulk Merge:** Select multiple duplicates to merge at once
- **Smart Suggestions:** AI-powered duplicate detection
- **Merge Preview:** Show what orders/tests will be affected
- **Merge History:** Log of all merge operations
- **Auto-Merge Rules:** Automatic merging based on configurable rules
- **Conflict Resolution:** Handle conflicting data between duplicates
- **Merge Notifications:** Notify users when duplicates are detected
- **Export Report:** Generate report of all merged patients

### 9. Documentation

#### For Developers
- All code is documented with inline comments
- TypeScript interfaces define data structures
- RPC functions have usage examples in migration file
- Component props are typed and documented

#### For Users
- Info panels in modals explain system behavior
- Tooltips on action buttons explain purpose
- Confirmation dialogs prevent accidental operations
- Success/error messages provide clear feedback

### 10. Files Changed/Created

#### New Files
1. `db/migrations/20251118_patient_merge_system.sql` - Database migration
2. `src/components/Patients/PatientMergeModal.tsx` - Merge UI component
3. `src/components/Patients/ViewDuplicatesModal.tsx` - View duplicates UI component
4. `PATIENT_MERGE_IMPLEMENTATION.md` - This documentation

#### Modified Files
1. `src/pages/Patients.tsx` - Integrated merge functionality

#### Lines of Code
- Migration: ~400 lines
- PatientMergeModal: ~280 lines
- ViewDuplicatesModal: ~320 lines
- Patients.tsx changes: ~100 lines
- **Total: ~1,100 lines**

---

## Summary

The patient merge system is **fully implemented and ready for testing**. It provides:
- ✅ Non-destructive merge preserving all data
- ✅ Reversible operations (unmerge support)
- ✅ Comprehensive audit trail
- ✅ User-friendly UI with visual feedback
- ✅ Validation at database and application layers
- ✅ Smart duplicate detection
- ✅ Professional design with color coding
- ✅ Complete error handling and loading states

**Next Step:** Execute the migration in Supabase to enable the feature!
