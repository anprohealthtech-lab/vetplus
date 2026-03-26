---
description: Implementation Plan for Location & B2B Specific Header/Footer in PDF Reports
---

# Location & B2B Specific Header/Footer Implementation Plan

## 📋 Overview

Add support for customizable headers and footers in PDF reports based on:
1. **Location** - Different headers/footers for different lab locations
2. **B2B Account** - Custom branded headers/footers for B2B accounts (hospitals, corporates)
3. **Signature** - Remains as per approver (existing logic)

---

## 🎯 Requirements

### **Current State:**
- Reports use lab-level header/footer
- Single header/footer for entire lab
- No location-specific customization
- No B2B account branding

### **Desired State:**
- **Priority 1**: B2B account-specific header/footer (highest priority)
- **Priority 2**: Location-specific header/footer
- **Priority 3**: Lab-level header/footer (fallback)
- **Signature**: Always based on approver (unchanged)

### **Fallback Logic:**
```
1. Check if order has account_id → Use B2B account header/footer
2. Else, check if order has location_id → Use location header/footer
3. Else → Use lab-level header/footer (default)
```

---

## 🗄️ Database Schema Changes

### **Option 1: Use Existing `attachments` Table (Recommended)**

**Advantages:**
- ✅ Table already exists
- ✅ Supports file uploads
- ✅ Has `entity_type` and `entity_id` for flexible linking
- ✅ Has `attachment_type` for categorization

**Schema:**
```sql
-- Existing attachments table structure (no changes needed)
CREATE TABLE public.attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,  -- 'lab', 'location', 'account', etc.
    entity_id uuid NOT NULL,    -- ID of the entity
    attachment_type text NOT NULL,  -- 'header', 'footer', 'logo', etc.
    file_url text NOT NULL,
    file_name text,
    file_size bigint,
    mime_type text,
    uploaded_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_attachments_entity 
ON attachments(entity_type, entity_id, attachment_type);
```

**Usage Examples:**
```sql
-- Lab-level header
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('lab', 'lab-uuid', 'header', 'https://storage.../header.html');

-- Location-specific header
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('location', 'location-uuid', 'header', 'https://storage.../location-header.html');

-- B2B account-specific header
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('account', 'account-uuid', 'header', 'https://storage.../b2b-header.html');

-- Footer examples
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('account', 'account-uuid', 'footer', 'https://storage.../b2b-footer.html');
```

---

### **Option 2: Add Dedicated Columns (Alternative)**

**Add to existing tables:**

```sql
-- Add to labs table
ALTER TABLE labs
ADD COLUMN header_html text,
ADD COLUMN footer_html text;

-- Add to locations table
ALTER TABLE locations
ADD COLUMN header_html text,
ADD COLUMN footer_html text;

-- Add to accounts table
ALTER TABLE accounts
ADD COLUMN header_html text,
ADD COLUMN footer_html text;
```

**Disadvantages:**
- ❌ Stores HTML directly in database (not ideal for large content)
- ❌ No file management
- ❌ Harder to version/update

**Recommendation:** Use Option 1 (attachments table)

---

## 📁 File Storage Structure

### **Supabase Storage Buckets:**

```
reports/
  └── (existing PDF reports)

attachments/
  ├── labs/
  │   ├── {lab_id}/
  │   │   ├── header.html
  │   │   ├── footer.html
  │   │   └── logo.png
  │
  ├── locations/
  │   ├── {location_id}/
  │   │   ├── header.html
  │   │   ├── footer.html
  │   │   └── logo.png
  │
  └── accounts/
      ├── {account_id}/
      │   ├── header.html
      │   ├── footer.html
      │   └── logo.png
```

---

## 🔧 Implementation Steps

### **Phase 1: Database Setup**

#### **Step 1.1: Verify/Create Attachments Table**
```sql
-- Check if attachments table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'attachments';

-- If not exists, create it
-- (Use schema from Option 1 above)
```

#### **Step 1.2: Create Indexes**
```sql
CREATE INDEX IF NOT EXISTS idx_attachments_entity 
ON attachments(entity_type, entity_id, attachment_type);

CREATE INDEX IF NOT EXISTS idx_attachments_type 
ON attachments(attachment_type);
```

#### **Step 1.3: Add RLS Policies**
```sql
-- Allow authenticated users to read attachments
CREATE POLICY "Users can read attachments"
ON attachments FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage attachments
CREATE POLICY "Admins can manage attachments"
ON attachments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('Admin', 'Owner')
  )
);
```

---

### **Phase 2: UI Components**

#### **Step 2.1: Header/Footer Upload Component**

**File**: `src/components/Settings/HeaderFooterUpload.tsx`

**Features:**
- Upload header HTML file
- Upload footer HTML file
- Preview header/footer
- Delete header/footer
- Support for labs, locations, and accounts

**Props:**
```typescript
interface HeaderFooterUploadProps {
  entityType: 'lab' | 'location' | 'account';
  entityId: string;
  entityName: string;
}
```

**UI:**
```
┌─────────────────────────────────────────┐
│ Header & Footer Settings                │
├─────────────────────────────────────────┤
│                                         │
│ Entity: City Hospital (B2B Account)    │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Header                          │   │
│ │ [Upload HTML] [Preview] [Delete]│   │
│ │ Current: custom-header.html     │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Footer                          │   │
│ │ [Upload HTML] [Preview] [Delete]│   │
│ │ Current: custom-footer.html     │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ℹ️ HTML files should be self-contained │
│    with inline CSS                     │
└─────────────────────────────────────────┘
```

#### **Step 2.2: Integration Points**

**Add to:**
1. **Lab Settings** (`/settings`)
   - Section: "Report Customization"
   - Upload lab-level header/footer

2. **Location Master** (`/masters/locations`)
   - Edit location modal
   - Tab: "Report Customization"
   - Upload location-specific header/footer

3. **Account Master** (`/masters/accounts`)
   - Edit account modal
   - Tab: "Report Customization"
   - Upload B2B account-specific header/footer

---

### **Phase 3: Backend Logic (PDF Generation)**

#### **Step 3.1: Fetch Header/Footer Function**

**File**: `supabase/functions/generate-pdf-auto/index.ts`

**Add new function:**
```typescript
/**
 * Fetch header/footer HTML for an order
 * Priority: B2B Account > Location > Lab
 */
async function fetchHeaderFooter(
  supabase: any,
  orderId: string,
  type: 'header' | 'footer'
): Promise<string | null> {
  // 1. Get order details
  const { data: order } = await supabase
    .from('orders')
    .select('account_id, location_id, lab_id')
    .eq('id', orderId)
    .single();

  if (!order) return null;

  // 2. Try B2B account-specific (highest priority)
  if (order.account_id) {
    const { data: accountAttachment } = await supabase
      .from('attachments')
      .select('file_url')
      .eq('entity_type', 'account')
      .eq('entity_id', order.account_id)
      .eq('attachment_type', type)
      .single();

    if (accountAttachment?.file_url) {
      return await fetchHTMLContent(accountAttachment.file_url);
    }
  }

  // 3. Try location-specific
  if (order.location_id) {
    const { data: locationAttachment } = await supabase
      .from('attachments')
      .select('file_url')
      .eq('entity_type', 'location')
      .eq('entity_id', order.location_id)
      .eq('attachment_type', type)
      .single();

    if (locationAttachment?.file_url) {
      return await fetchHTMLContent(locationAttachment.file_url);
    }
  }

  // 4. Fallback to lab-level
  if (order.lab_id) {
    const { data: labAttachment } = await supabase
      .from('attachments')
      .select('file_url')
      .eq('entity_type', 'lab')
      .eq('entity_id', order.lab_id)
      .eq('attachment_type', type)
      .single();

    if (labAttachment?.file_url) {
      return await fetchHTMLContent(labAttachment.file_url);
    }
  }

  // 5. Return default/null
  return null;
}

/**
 * Fetch HTML content from URL
 */
async function fetchHTMLContent(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch HTML from ${url}`);
    return '';
  }
  return await response.text();
}
```

#### **Step 3.2: Modify PDF Generation**

**Update main PDF generation function:**
```typescript
// In generate-pdf-auto/index.ts

async function generatePDF(orderId: string, supabase: any) {
  // ... existing code ...

  // Fetch custom header/footer
  const headerHTML = await fetchHeaderFooter(supabase, orderId, 'header');
  const footerHTML = await fetchHeaderFooter(supabase, orderId, 'footer');

  // Build PDF payload
  const pdfPayload = {
    html: reportHTML,
    headerTemplate: headerHTML || defaultHeaderHTML,
    footerTemplate: footerHTML || defaultFooterHTML,
    displayHeaderFooter: true,
    // ... other settings ...
  };

  // ... rest of PDF generation ...
}
```

---

### **Phase 4: Header/Footer Templates**

#### **Default Templates:**

**Default Header Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 10px 20px;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 5px;
    }
    .logo {
      max-height: 50px;
    }
    .lab-info {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <img src="{{LAB_LOGO}}" class="logo" alt="Lab Logo">
    </div>
    <div class="lab-info">
      <strong>{{LAB_NAME}}</strong><br>
      {{LAB_ADDRESS}}<br>
      Phone: {{LAB_PHONE}}
    </div>
  </div>
</body>
</html>
```

**Default Footer Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 10px 20px;
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #666;
    }
    .footer-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #ddd;
      padding-top: 5px;
    }
  </style>
</head>
<body>
  <div class="footer-container">
    <div>
      Generated on: {{GENERATED_DATE}}
    </div>
    <div>
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
    <div>
      {{LAB_NAME}} | {{LAB_WEBSITE}}
    </div>
  </div>
</body>
</html>
```

**B2B Account Template Example:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 10px 20px;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 5px;
    }
    .logo {
      max-height: 60px;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <img src="{{ACCOUNT_LOGO}}" class="logo" alt="Hospital Logo">
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0;">{{ACCOUNT_NAME}}</h2>
      <p style="margin: 5px 0;">{{ACCOUNT_ADDRESS}}</p>
      <p style="margin: 0;">Lab Partner: {{LAB_NAME}}</p>
    </div>
  </div>
</body>
</html>
```

---

## 🧪 Testing Plan

### **Test Cases:**

1. **Lab-Level Header/Footer**
   - Upload header/footer for lab
   - Generate report for order without account/location
   - Verify lab header/footer is used

2. **Location-Specific Header/Footer**
   - Upload header/footer for location
   - Generate report for order with location_id
   - Verify location header/footer is used

3. **B2B Account Header/Footer**
   - Upload header/footer for B2B account
   - Generate report for order with account_id
   - Verify B2B header/footer is used (highest priority)

4. **Fallback Logic**
   - Order with account_id but no account header → Use location/lab
   - Order with location_id but no location header → Use lab
   - Order with no custom headers → Use default

5. **Signature**
   - Verify signature remains based on approver
   - Not affected by header/footer changes

---

## 📊 Data Flow

```
Order Created
    ↓
PDF Generation Triggered
    ↓
Fetch Order Details (account_id, location_id, lab_id)
    ↓
Check Priority:
    1. B2B Account Header/Footer?
       ↓ Yes → Use Account Header/Footer
       ↓ No
    2. Location Header/Footer?
       ↓ Yes → Use Location Header/Footer
       ↓ No
    3. Lab Header/Footer?
       ↓ Yes → Use Lab Header/Footer
       ↓ No
    4. Use Default Template
    ↓
Fetch Signature (Based on Approver)
    ↓
Generate PDF with:
    - Custom Header
    - Report Body
    - Custom Footer
    - Approver Signature
    ↓
Save to Storage
```

---

## 🎨 UI/UX Considerations

### **Upload Interface:**
- Drag-and-drop HTML file upload
- Live preview of header/footer
- Template variables documentation
- Example templates provided
- Validation (max file size, HTML only)

### **Template Variables:**
Provide placeholders that get replaced:
- `{{LAB_NAME}}`
- `{{LAB_LOGO}}`
- `{{LAB_ADDRESS}}`
- `{{LAB_PHONE}}`
- `{{ACCOUNT_NAME}}`
- `{{ACCOUNT_LOGO}}`
- `{{LOCATION_NAME}}`
- `{{GENERATED_DATE}}`
- `{{REPORT_ID}}`

---

## 📝 Migration Strategy

### **For Existing Labs:**
1. Keep current header/footer as lab-level default
2. Gradually migrate to new system
3. No breaking changes

### **For New Labs:**
1. Provide default templates
2. Allow customization from day 1

---

## ⚙️ Configuration

### **Environment Variables:**
```env
# Storage bucket for attachments
ATTACHMENTS_BUCKET=attachments

# Max file size for header/footer (in bytes)
MAX_HEADER_FOOTER_SIZE=102400  # 100KB
```

### **Lab Settings:**
```json
{
  "pdf_settings": {
    "allow_location_headers": true,
    "allow_b2b_headers": true,
    "header_height": "120px",
    "footer_height": "80px"
  }
}
```

---

## 🚀 Deployment Plan

### **Phase 1: Foundation (Week 1)**
- ✅ Verify/create attachments table
- ✅ Add indexes and RLS policies
- ✅ Create storage bucket structure

### **Phase 2: Backend (Week 2)**
- ✅ Implement fetchHeaderFooter function
- ✅ Modify generate-pdf-auto function
- ✅ Test fallback logic

### **Phase 3: UI (Week 3)**
- ✅ Create HeaderFooterUpload component
- ✅ Integrate into Lab Settings
- ✅ Integrate into Location Master
- ✅ Integrate into Account Master

### **Phase 4: Testing & Refinement (Week 4)**
- ✅ End-to-end testing
- ✅ Template examples
- ✅ Documentation
- ✅ User training

---

## 📚 Documentation Needed

1. **Admin Guide:**
   - How to upload custom headers/footers
   - Template variable reference
   - Best practices

2. **Developer Guide:**
   - Database schema
   - API endpoints
   - Fallback logic

3. **Template Guide:**
   - HTML structure
   - CSS guidelines
   - Variable substitution
   - Examples

---

## ✅ Success Criteria

- [ ] B2B accounts can have custom branded headers/footers
- [ ] Locations can have location-specific headers/footers
- [ ] Labs can have default headers/footers
- [ ] Fallback logic works correctly
- [ ] Signatures remain based on approver
- [ ] No breaking changes to existing reports
- [ ] Performance: <2s additional time for header/footer fetch
- [ ] UI is intuitive and easy to use

---

## 🔐 Security Considerations

1. **File Validation:**
   - Only allow HTML files
   - Sanitize HTML content
   - Max file size limit

2. **Access Control:**
   - Only admins can upload headers/footers
   - RLS policies enforced

3. **Storage:**
   - Secure storage bucket
   - Proper CORS configuration

---

## 💡 Future Enhancements

1. **Template Builder:**
   - Visual editor for headers/footers
   - Drag-and-drop components

2. **Version Control:**
   - Track header/footer versions
   - Rollback capability

3. **A/B Testing:**
   - Test different headers/footers
   - Analytics on report engagement

4. **Dynamic Content:**
   - Pull data from database
   - Personalized headers per patient

---

## 📞 Support

For implementation questions:
- Check existing `attachments` table structure
- Review `generate-pdf-auto` function
- Test with sample HTML templates
- Validate fallback logic

---

**Status**: Ready for Implementation
**Priority**: High
**Estimated Effort**: 3-4 weeks
**Dependencies**: Attachments table, Storage bucket, PDF generation function
