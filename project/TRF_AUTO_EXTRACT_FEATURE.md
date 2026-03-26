# TRF (Test Request Form) Auto-Extract Feature

## Overview

This feature enables automatic extraction of patient information, test selections, and clinical notes from uploaded Test Request Form (TRF) images using Google Vision AI OCR and Gemini NLP. The system intelligently matches patients and tests, auto-fills the order creation form, and provides a verification interface.

## Architecture

```
User uploads TRF image
         ↓
1. File uploaded to Supabase Storage
         ↓
2. Google Vision API extracts text (OCR)
         ↓
3. Gemini NLP structures the extracted data
         ↓
4. System matches patient (fuzzy search by name/phone)
         ↓
5. System matches test names to test_groups
         ↓
6. Form auto-populated with extracted data
         ↓
7. User reviews and verifies in modal
         ↓
8. User confirms and creates order
```

## Components

### 1. Supabase Edge Function: `process-trf`

**Location**: `supabase/functions/process-trf/index.ts`

**Functionality**:
- Receives TRF image (via attachment ID or base64)
- Calls Google Vision API for OCR text extraction
- Sends text + image to Gemini API for structured extraction
- Performs fuzzy patient matching (Levenshtein distance)
- Matches test names to database `test_groups`
- Updates attachment record with AI metadata
- Returns structured JSON response

**API Request**:
```typescript
POST /functions/v1/process-trf
{
  "attachmentId": "uuid",  // OR
  "imageBase64": "base64-string"
}
```

**API Response**:
```typescript
{
  "success": true,
  "patientInfo": {
    "name": "John Doe",
    "age": 35,
    "gender": "Male",
    "phone": "9876543210",
    "email": "john@example.com",
    "confidence": 0.92
  },
  "requestedTests": [
    {
      "testName": "Complete Blood Count",
      "testGroupId": "uuid",
      "matched": true,
      "confidence": 0.95
    }
  ],
  "doctorInfo": {
    "name": "Dr. Smith",
    "specialization": "General Medicine",
    "confidence": 0.88
  },
  "clinicalNotes": "Patient complains of fever for 3 days",
  "urgency": "Normal",
  "matchedPatient": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "9876543210",
    "matchConfidence": 0.95
  }
}
```

**Required Environment Variables**:
```bash
ALLGOOGLE_KEY=your-google-api-key  # Used for both Vision and Gemini APIs
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Client Utility: `trfProcessor.ts`

**Location**: `src/utils/trfProcessor.ts`

**Key Functions**:

#### `processTRFImage(file, onProgress)`
Uploads file and processes with OCR + NLP, providing real-time progress updates.

```typescript
const result = await processTRFImage(file, (progress) => {
  console.log(progress.stage, progress.progress, progress.message);
});
```

**Progress Stages**:
1. `uploading` (10%) - Uploading to Supabase Storage
2. `ocr` (30%) - Google Vision text extraction
3. `nlp` (60%) - Gemini AI structuring
4. `matching` (80%) - Patient and test matching
5. `complete` (100%) - Processing complete
6. `error` (0%) - Error occurred

#### `trfToOrderFormData(extraction)`
Converts TRF extraction result to order form data structure.

```typescript
const formData = trfToOrderFormData(result);
// Returns: { patientData, matchedPatientId, selectedTestIds, clinicalNotes, etc. }
```

#### `formatConfidence(confidence)`
Formats confidence scores for UI display.

```typescript
const display = formatConfidence(0.92);
// Returns: { label: 'High Confidence', color: 'text-green-700', bgColor: 'bg-green-100' }
```

### 3. Updated Component: `OrderForm.tsx`

**Location**: `src/components/Orders/OrderForm.tsx`

**New Features**:

#### Auto-Processing on Upload
When user uploads TRF image, processing automatically starts:
```typescript
const handleFileChange = async (e) => {
  // Upload file
  // Process with AI
  // Auto-fill form
  // Show review modal
}
```

#### Visual Feedback
- **Processing State**: Animated spinner + progress bar + stage messages
- **Success State**: Green checkmark + "Review Extracted Data" button
- **Error State**: Red alert with error message
- **Unmatched Tests Warning**: Yellow banner listing tests that couldn't be auto-matched

#### TRF Review Modal
Comprehensive review interface showing:
- **Patient Information**: Name, age, gender, phone, email
- **Matched Patient**: If existing patient found (with confidence score)
- **New Patient Alert**: If no match found
- **Requested Tests**: List with match status and confidence scores
- **Doctor Information**: Referring doctor details
- **Clinical Notes**: Extracted clinical history
- **Additional Info**: Location, urgency, collection date

#### Auto-Population Logic
```typescript
// If patient matched with >80% confidence → auto-select
if (formData.matchConfidence > 0.8) {
  setSelectedPatient(matched);
}

// Auto-select matched tests
setSelectedTests(formData.selectedTestIds);

// Set clinical notes
setNotes(formData.clinicalNotes);

// Set urgency
setPriority(formData.urgency);
```

## User Workflow

### 1. Create New Order
User clicks "Create New Order" button

### 2. Upload TRF
- Click TRF upload area
- Select image (JPG/PNG/PDF, max 10MB)
- File automatically uploads and processing starts

### 3. AI Processing (Automatic)
- **Stage 1**: Uploading... (shows progress bar)
- **Stage 2**: Extracting text with Google Vision AI...
- **Stage 3**: Analyzing document with AI...
- **Stage 4**: Matching tests and patients...
- **Complete**: TRF Processed Successfully ✓

### 4. Review Extracted Data
- Click "Review Extracted Data" button
- Modal opens showing:
  - Patient info with confidence scores
  - Matched existing patient (if found)
  - List of tests (green = matched, yellow = needs manual selection)
  - Doctor information
  - Clinical notes
  - Urgency level

### 5. Verify and Adjust
- Form is auto-filled based on extraction
- Yellow warning shows unmatched tests
- User manually selects any unmatched tests from dropdown
- User can modify any auto-filled fields

### 6. Create Order
- Click "Create Order" button
- Order created with all extracted information

## Patient Matching Logic

### Matching Priority
1. **Phone Number Match** (95% confidence)
   - Exact 10-digit phone match
   - Highest priority

2. **Exact Name Match** (90% confidence)
   - Case-insensitive full name match

3. **Partial Name Match** (70% confidence)
   - Name contains search term or vice versa

4. **Fuzzy Name Match** (>80% similarity)
   - Levenshtein distance algorithm
   - Handles typos and variations
   - Confidence = similarity score × 0.85

### Example Matches
```typescript
// Patient in DB: "John Michael Smith" / "9876543210"
// TRF says: "John Smith" / "9876543210"
// Match: 95% (phone match)

// Patient in DB: "Priya Sharma" / "9123456789"
// TRF says: "Priya Sharme" / "9123456789"  // typo
// Match: 95% (phone match)

// Patient in DB: "Rajesh Kumar" / "9234567890"
// TRF says: "Rajesh K" / null
// Match: 70% (partial name)
```

## Test Name Matching

### Standardization
The Gemini AI automatically standardizes test abbreviations:

| TRF Text | Standardized Name |
|----------|-------------------|
| CBC | Complete Blood Count with Differential |
| LFT | Liver Function Test |
| KFT/RFT | Kidney Function Test |
| TFT | Thyroid Function Test |
| HbA1c | Glycated Hemoglobin |
| FBS | Fasting Blood Sugar |
| PPBS | Post Prandial Blood Sugar |
| Urine R/M | Urine Routine Micro Examination |

### Matching Logic
1. **Exact match**: Test name = DB test name (100%)
2. **Code match**: Test abbreviation = DB code (100%)
3. **Contains match**: Partial string match (80%)

### Unmatched Tests
Tests that can't be matched appear in yellow warning banner:
```
⚠️ Some tests couldn't be matched automatically
Please manually select: Vitamin D, Ferritin
```

## Confidence Scoring

### High Confidence (≥90%)
- Green badge
- Auto-populated without review required
- OCR quality: Excellent
- Text clarity: High

### Medium Confidence (70-89%)
- Yellow badge
- Auto-populated but review recommended
- OCR quality: Good
- Text clarity: Medium

### Low Confidence (<70%)
- Red badge
- Manual verification required
- OCR quality: Poor
- Text clarity: Low

## Error Handling

### Common Errors
1. **Vision API Failure**
   ```
   Error: Vision API failed: 403 Forbidden
   Solution: Check GOOGLE_VISION_API_KEY
   ```

2. **Gemini API Failure**
   ```
   Error: Gemini API failed: Invalid API key
   Solution: Check GEMINI_API_KEY
   ```

3. **File Upload Failure**
   ```
   Error: Failed to upload file
   Solution: Check Supabase storage permissions
   ```

4. **No Text Extracted**
   ```
   Error: No text found in image
   Solution: Use clearer image, ensure proper lighting
   ```

### Fallback Behavior
- If AI processing fails, user can still manually fill form
- TRF file is saved as attachment for manual review
- Error message shown with retry option

## Database Schema Impact

### Attachments Table Updates
```sql
-- New AI-related fields
ai_processed: boolean
ai_confidence: float
ai_extracted_data: jsonb

-- Example data
{
  "patientInfo": { "name": "...", "phone": "..." },
  "requestedTests": [...],
  "matchedPatient": { "id": "...", "matchConfidence": 0.95 }
}
```

## Testing

### Manual Testing Steps

1. **Prepare Test TRF Image**
   - Create sample TRF with patient details
   - Include 3-5 common tests
   - Add clinical notes

2. **Test New Patient Scenario**
   - Upload TRF with unknown patient
   - Verify "New Patient" alert shows
   - Verify patient form fields auto-filled
   - Create order and check new patient created

3. **Test Existing Patient Match**
   - Upload TRF with existing patient details
   - Verify green "Matched Existing Patient" banner
   - Verify correct patient auto-selected
   - Verify match confidence shown

4. **Test Partial Name Match**
   - Upload TRF with typo in patient name
   - Verify fuzzy match works (>70% confidence)
   - Check patient matched correctly

5. **Test Unmatched Tests**
   - Upload TRF with obscure test names
   - Verify yellow warning banner appears
   - Verify unmatched tests listed
   - Manually select from dropdown

6. **Test Progress Indicators**
   - Upload large image
   - Verify progress bar animates
   - Verify stage messages update
   - Verify completion checkmark

### API Environment Variables Setup

```bash
# In Supabase Dashboard → Project Settings → Edge Functions → Secrets
GOOGLE_VISION_API_KEY=AIzaSy...
GEMINI_API_KEY=AIzaSy...
```

## Deployment

### 1. Deploy Edge Function
```bash
cd "d:\LIMS version 2\project"
supabase functions deploy process-trf
```

### 2. Set Secrets
```bash
supabase secrets set GOOGLE_VISION_API_KEY=your-key
supabase secrets set GEMINI_API_KEY=your-key
```

### 3. Test Edge Function
```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-trf \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"attachmentId": "test-uuid"}'
```

### 4. Deploy Frontend
```bash
npm run build
npx netlify deploy --prod
```

## Performance Considerations

### Expected Processing Times
- File upload: 1-2 seconds
- Google Vision OCR: 2-4 seconds
- Gemini NLP: 3-5 seconds
- Patient/test matching: <1 second
- **Total**: 6-12 seconds

### Optimization Tips
1. Compress images before upload (reduces upload time)
2. Use clear, high-contrast TRF images (improves OCR accuracy)
3. Ensure proper lighting when capturing TRF photo
4. Avoid blurry or low-resolution images

## Future Enhancements

1. **Batch Processing**: Upload multiple TRFs at once
2. **Template Learning**: System learns lab-specific TRF formats
3. **Doctor Matching**: Auto-match doctor names to DB
4. **Location Matching**: Extract and match collection locations
5. **Signature Detection**: Detect doctor signatures for auto-validation
6. **Historical Data**: Show confidence trends over time
7. **Manual Correction Feedback**: Learn from user corrections

## Troubleshooting

### Issue: Low Confidence Scores
**Solution**: 
- Use higher resolution images
- Ensure good lighting
- Avoid handwritten text if possible
- Use standard TRF formats

### Issue: Patient Not Matching
**Solution**:
- Check phone number format (must be 10 digits)
- Verify patient name spelling
- Try manual patient search
- Create new patient if truly new

### Issue: Tests Not Matching
**Solution**:
- Check test name standardization
- Use common test abbreviations
- Manually select from test dropdown
- Contact admin to add test aliases

### Issue: Processing Timeout
**Solution**:
- Check Supabase Edge Function logs
- Verify API keys are set correctly
- Reduce image file size
- Retry with simpler TRF

## Support

For issues or questions:
1. Check Supabase Edge Function logs
2. Review browser console for errors
3. Verify environment variables set
4. Test with sample TRF images
5. Contact development team

---

**Last Updated**: November 9, 2025
**Version**: 1.0.0
**Dependencies**: 
- Google Vision API (v1)
- Gemini API (v1beta/gemini-1.5-flash)
- Supabase Edge Functions (Deno runtime)
