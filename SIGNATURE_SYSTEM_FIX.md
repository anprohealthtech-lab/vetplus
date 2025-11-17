# Signature System Fix - Complete User Flow

**Date**: November 17, 2025  
**Status**: ✅ Fixed & Deployed

---

## Issues Fixed

### 1. ❌ Column Name Mismatch Error
**Error**: `column lab_user_signatures_1.signature_url does not exist`

**Root Cause**: 
- Query was looking for `signature_url` 
- Database table has `file_url` column

**Solution**:
Updated `database.users.getLabUsers()` query to use correct column names:
```typescript
lab_user_signatures!lab_user_signatures_user_id_fkey(
  id,
  signature_name,      // ✅ Changed
  file_url,            // ✅ Changed from signature_url
  imagekit_url,
  is_active,
  is_default           // ✅ Added
)
```

### 2. ❌ Missing User Selection in Signature Upload
**Problem**: SignatureUploader component didn't allow selecting which user the signature belongs to

**Solution**: Added complete user selection flow:
- User dropdown populated from lab users
- Auto-selects current user by default
- Can upload signature for any user in the lab
- Shows user info (name + email) in dropdown

---

## Complete Signature Flow

### 1. Upload Signature (BrandingSettings Page)

**Location**: `/branding-settings` → Signatures tab → "Add Signature" button

**New UI Flow**:
```
1. Click "Add Signature"
2. Select User (dropdown with all lab users)
3. Enter Signature Name
4. Select Type (digital/handwritten/stamp)
5. Upload Image File
6. Click "Upload signature"
```

**Behind the Scenes**:
```typescript
// Frontend: SignatureUploader.tsx
const selectedUserId = useState(currentUser.id); // Default to current user
const users = await database.users.getLabUsers(labId); // Load all lab users

// On submit:
fetch('/.netlify/functions/branding-upload', {
  body: JSON.stringify({
    labId,
    userId: selectedUserId,  // ✅ Now passes selected user
    signatureType,
    fileName,
    base64Data,
    assetName: signatureName,
  })
});
```

**Backend Processing** (`branding-upload.js`):
```javascript
// 1. Upload to Supabase Storage
await supabase.storage.from('attachments').upload(storagePath, buffer);

// 2. Create database record
const insertData = {
  lab_id: labId,
  user_id: userId,           // ✅ Links to specific user
  signature_type: signatureType,
  signature_name: safeName,
  file_url: publicUrl,
  file_path: storagePath,
  status: 'pending',         // Will be processed by ImageKit
};

await supabase.from('lab_user_signatures').insert(insertData);

// 3. Trigger background processing
fetch('/.netlify/functions/imagekit-process', {
  body: JSON.stringify({ assetId, tableName, storagePath })
});
```

**ImageKit Processing** (`imagekit-process` function):
```javascript
// 1. Download from Supabase Storage
// 2. Upload to ImageKit with transformations
// 3. Update database with imagekit_url
// 4. Set status to 'ready'
```

### 2. View All Lab Signatures

**Updated BrandingSettings Page**:
```typescript
// ✅ Now loads ALL signatures for the lab (not just current user's)
const { data: signatures } = await database.userSignatures.getAllForLab(labId);

// Returns signatures with user info:
{
  id: "...",
  signature_name: "Dr. Kumar Official Signature",
  file_url: "https://supabase.co/storage/...",
  imagekit_url: "https://ik.imagekit.io/...",
  users: {                    // ✅ User information included
    id: "...",
    name: "Dr. A. Kumar",
    email: "dr.kumar@lab.com",
    role: "Admin"
  }
}
```

**SignatureCard Component** now displays:
- Signature name
- Signature type (digital/handwritten/stamp)
- **User info** (name + email) - NEW!
- Preview image
- Default badge (if applicable)
- Set as default button
- Remove button

### 3. Use Signature in Reports

**Template Placeholder**:
```html
<!-- In CKEditor template -->
{{approverSignature}}
```

**Report Generation** (`v_report_template_context` view):
```sql
-- View includes signature data for report approver
SELECT 
  o.approved_by,
  u_approver.name as approver_name,
  sig.imagekit_url as approver_signature_url  -- ✅ Uses imagekit_url
FROM orders o
LEFT JOIN users u_approver ON o.approved_by = u_approver.id
LEFT JOIN lab_user_signatures sig 
  ON sig.user_id = u_approver.id 
  AND sig.is_default = true 
  AND sig.is_active = true;
```

---

## Database Schema

### lab_user_signatures Table
```sql
CREATE TABLE lab_user_signatures (
  id UUID PRIMARY KEY,
  lab_id UUID REFERENCES labs(id),
  user_id UUID REFERENCES users(id),           -- ✅ Links signature to user
  
  signature_type VARCHAR(50),                  -- digital/handwritten/stamp/text
  signature_name VARCHAR(200),
  
  -- File storage
  file_url TEXT,                               -- ✅ Supabase public URL
  file_path TEXT,                              -- Storage path
  storage_bucket TEXT DEFAULT 'attachments',
  storage_path TEXT,
  
  -- ImageKit CDN
  imagekit_file_id TEXT,
  imagekit_url TEXT,                           -- ✅ Processed CDN URL
  variants JSONB,                              -- Different sizes/formats
  
  -- Status tracking
  status TEXT DEFAULT 'pending',               -- pending/processing/ready/error
  processed_at TIMESTAMP,
  last_error TEXT,
  
  -- Metadata
  file_type VARCHAR(50),
  file_size BIGINT,
  dimensions JSONB,
  description TEXT,
  usage_context TEXT[],                        -- ['reports', 'prescriptions']
  
  -- Flags
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,            -- One default per user per lab
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Foreign Key Relationships
```
users.id ←→ lab_user_signatures.user_id      (whose signature)
users.id ←→ lab_user_signatures.created_by   (who uploaded)
users.id ←→ lab_user_signatures.updated_by   (who modified)
```

**Critical**: When querying with joins, must specify which relationship:
```typescript
// ❌ Ambiguous - causes PostgREST error
.select('*, lab_user_signatures(*)')

// ✅ Explicit - works correctly
.select('*, lab_user_signatures!lab_user_signatures_user_id_fkey(*)')
```

---

## API Functions

### New/Updated Functions

#### 1. `database.users.getLabUsers(labId)`
```typescript
// Returns all users with their signatures
{
  data: [
    {
      id: "user-uuid",
      name: "Dr. Kumar",
      email: "dr.kumar@lab.com",
      role: "Admin",
      lab_user_signatures: [        // ✅ Explicit relationship
        {
          id: "sig-uuid",
          signature_name: "Official",
          file_url: "...",
          imagekit_url: "...",
          is_active: true,
          is_default: true
        }
      ]
    }
  ]
}
```

#### 2. `database.userSignatures.getAllForLab(labId)` - NEW!
```typescript
// Returns ALL signatures for a lab (not just current user's)
{
  data: [
    {
      id: "sig-uuid",
      signature_name: "Dr. Kumar Official",
      file_url: "...",
      imagekit_url: "...",
      users: {                      // ✅ User info included
        id: "user-uuid",
        name: "Dr. A. Kumar",
        email: "dr.kumar@lab.com",
        role: "Admin"
      }
    }
  ]
}
```

#### 3. `database.userSignatures.getAll(userId?, labId?)`
```typescript
// Returns signatures for specific user (current user by default)
{
  data: [/* signatures for one user */]
}
```

#### 4. `database.userSignatures.getDefault(userId?, labId?)`
```typescript
// Returns default signature for user
{
  data: {
    id: "sig-uuid",
    is_default: true,
    imagekit_url: "https://ik.imagekit.io/..."
  }
}
```

---

## Component Updates

### SignatureUploader.tsx

**New Features**:
1. ✅ User selection dropdown
2. ✅ Loads all lab users on mount
3. ✅ Auto-selects current user as default
4. ✅ Passes selected user ID to backend
5. ✅ Shows loading state while fetching users

**Code Structure**:
```typescript
const [selectedUserId, setSelectedUserId] = useState(currentUserId);
const [users, setUsers] = useState<User[]>([]);
const [loadingUsers, setLoadingUsers] = useState(true);

useEffect(() => {
  loadUsers(); // Fetch all lab users
}, [labId]);

// On submit, use selectedUserId instead of fixed userId
```

### SignatureCard.tsx

**New Display**:
- Shows user name and email below signature info
- Format: `User: Dr. A. Kumar (dr.kumar@lab.com)`

**Updated Interface**:
```typescript
interface SignatureSummary {
  id: string;
  signature_name: string;
  file_url?: string;
  users?: {               // ✅ Added user info
    id: string;
    name: string;
    email: string;
    role?: string;
  };
}
```

### BrandingSettings.tsx

**Updated Data Loading**:
```typescript
// ❌ Before: Only loaded current user's signatures
const { data } = await database.userSignatures.getAll();

// ✅ After: Loads all lab signatures with user info
const { data } = await database.userSignatures.getAllForLab(labId);
```

---

## Testing Checklist

### ✅ Database Level
- [x] `file_url` column exists in lab_user_signatures
- [x] Foreign key `user_id` references users(id)
- [x] PostgREST relationship specified correctly
- [x] Query returns correct columns

### ✅ API Level
- [x] `database.users.getLabUsers()` returns signatures with correct columns
- [x] `database.userSignatures.getAllForLab()` returns all lab signatures
- [x] Explicit relationship `!lab_user_signatures_user_id_fkey` works

### ✅ Component Level
- [x] SignatureUploader loads users dropdown
- [x] User selection works correctly
- [x] Selected user ID passed to backend
- [x] SignatureCard displays user information
- [x] BrandingSettings loads all lab signatures

### ✅ Upload Flow
- [x] Can select any lab user for signature
- [x] Upload creates record with correct user_id
- [x] File saved to Supabase Storage
- [x] ImageKit processing triggered
- [x] Signature appears in list with user info

### ✅ Build & Deployment
- [x] TypeScript compilation successful
- [x] Vite build completes
- [x] Deployed to production
- [x] No console errors

---

## User Workflow Example

### Scenario: Lab Admin uploads signature for Dr. Kumar

**Step-by-Step**:

1. **Admin navigates to Branding Settings**
   - URL: `/branding-settings`
   - Tab: Signatures

2. **Admin clicks "Add Signature"**
   - Modal opens with form

3. **Admin selects user**
   - Dropdown shows: "Dr. A. Kumar (dr.kumar@lab.com)"
   - Selects Dr. Kumar

4. **Admin fills form**
   - Signature Name: "Dr. Kumar Official Signature"
   - Type: "Digital"
   - File: Uploads PNG image

5. **Admin submits**
   - File uploads to Supabase Storage
   - Database record created with `user_id = dr.kumar.id`
   - Background job processes through ImageKit
   - Status: pending → processing → ready

6. **Signature appears in list**
   - Shows: "Dr. Kumar Official Signature"
   - Type: digital
   - User: Dr. A. Kumar (dr.kumar@lab.com)
   - Preview image displayed

7. **Set as default** (if needed)
   - Click "Set as default" button
   - Updates `is_default = true` for this signature
   - Sets other signatures for same user to `is_default = false`

8. **Signature used in reports**
   - When Dr. Kumar approves a report
   - System fetches his default signature
   - Template placeholder `{{approverSignature}}` replaced with ImageKit URL
   - Signature appears in PDF

---

## Benefits

### Before (Problems)
❌ Query error: "signature_url does not exist"  
❌ Couldn't select which user the signature belongs to  
❌ Only saw current user's signatures  
❌ No way to manage signatures for other users  
❌ Unclear who owns each signature  

### After (Solutions)
✅ Correct column names (`file_url`, `imagekit_url`)  
✅ User dropdown to select any lab user  
✅ View all lab signatures in one place  
✅ Admin can upload signatures for any user  
✅ User info clearly displayed on each signature  
✅ Complete audit trail (created_by, updated_by)  

---

## Next Steps (Future Enhancements)

### Medium Priority
1. Add signature approval workflow
2. Allow users to have multiple signatures (personal, official, etc.)
3. Signature expiry dates
4. Usage tracking (which reports used which signature)

### Low Priority
5. Signature version history
6. Text-based signatures (currently disabled)
7. Batch upload multiple signatures
8. Signature templates library

---

## Files Modified

### Database Schema
- `supabase/migrations/20250126000001_add_branding_signature_system.sql` (existing)
- Table: `lab_user_signatures` with `file_url` column

### API Layer
- ✅ `src/utils/supabase.ts`
  - Fixed `database.users.getLabUsers()` column names
  - Added `database.userSignatures.getAllForLab()` function

### Components
- ✅ `src/components/Branding/SignatureUploader.tsx`
  - Added user selection dropdown
  - Load all lab users
  - Pass selected user ID to backend

- ✅ `src/components/Branding/SignatureCard.tsx`
  - Display user information
  - Updated interface with user object

### Pages
- ✅ `src/pages/BrandingSettings.tsx`
  - Changed to use `getAllForLab()` instead of `getAll()`
  - Now shows all lab signatures

---

## Production Status

**Deployment**: ✅ Live at https://eclectic-sunshine-3d25be.netlify.app

**Build Info**:
- Build time: 33.34s
- Bundle size: 6,132.68 KB
- Functions: 20 serverless functions deployed
- Status: No errors

**Testing URL**: `/branding-settings`

**Verification Steps**:
1. Login to LIMS
2. Navigate to Branding Settings → Signatures tab
3. Click "Add Signature"
4. Verify user dropdown appears
5. Select user, upload signature
6. Verify signature appears with user info
7. Check UserManagement page shows signatures

---

## Conclusion

The signature system is now fully functional with proper user assignment. The complete flow from upload → storage → processing → display → report generation is working correctly with clear user ownership and admin management capabilities.

**Key Achievement**: Fixed the column name mismatch and implemented a complete user-centric signature management system that allows admins to manage signatures for all lab users.
