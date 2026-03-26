here’s a copy-paste “Builder Prompt” you can drop into your AI app builder. It tells it exactly how to use your **direct-gemini-image-analysis-processor** function to create a new order from an uploaded TRF, including ImageKit upload/transform, the request JSON shape (with lab-scoped catalogs), mapping, and DB writes that match your schema.

---

# 🔧 Builder Prompt: “Create Order from TRF (ImageKit → Gemini → Supabase)”

**Goal:**
When a user uploads a Test Requisition Form (TRF) image, use **ImageKit** to normalize the image, call **direct-gemini-image-analysis-processor** with a **lab-scoped catalog** (tests, doctors, accounts, locations), then **create** patient + order + order\_tests, and **attach** the processed ImageKit URL to the order.

## 0) Inputs / env

* `LAB_ID` (uuid) — required
* Supabase REST base URL + service key (server-side)
* ImageKit public/private keys (client for upload; server can fetch via URL)
* Edge Function: `direct-gemini-image-analysis-processor` (POST)

## 1) Upload to ImageKit (client)

Use **imagekit-react** to upload the TRF. After upload, construct an OCR-friendly transformed URL:

```
tr = "w-1600,q-85,e-auto-rotate,e-sharpen-50,e-contrast-10,e-grayscale"
finalUrl = `${originalUrl}?tr=${tr}`
```

> Keep grayscale for TRFs; if color is needed, omit `e-grayscale`.

## 2) Insert attachment (pre-order)

Insert a row into `attachments` with the normalized **ImageKit** URL.

* Table: `public.attachments`
* Minimal fields:

  * `lab_id`: LAB\_ID
  * `related_table`: 'orders'  (we will set `order_id` after order is created)
  * `related_id`: a temporary UUID (or omit; will PATCH later)
  * `file_url`: `finalUrl`
  * `file_type`: 'image/jpeg' (or detected)
  * `description`: 'TRF upload'
  * `tag`: 'trf'

Store the returned `attachment_id`.

## 3) Build lab-scoped catalogs (server)

Fetch compact catalogs for matching:

* **Test Groups** (active, lab or global):

  ```
  GET /rest/v1/test_groups?select=id,name,code&is_active=eq.true&or=(lab_id.eq.{LAB_ID},lab_id.is.null)
  ```
* **Doctors**:

  ```
  GET /rest/v1/doctors?select=id,name&lab_id=eq.{LAB_ID}&is_active=eq.true
  ```
* **Accounts**:

  ```
  GET /rest/v1/accounts?select=id,name,code&lab_id=eq.{LAB_ID}&is_active=eq.true
  ```
* **Locations**:

  ```
  GET /rest/v1/locations?select=id,name&lab_id=eq.{LAB_ID}&is_active=eq.true
  ```

> Pass only `{id,name,code}` to keep payload small.

## 4) Call the Edge Function

**Function:** `direct-gemini-image-analysis-processor` (POST)
**Headers:**

* `Content-Type: application/json`
* `x-attachment-id: <attachment_id>`
* `x-commit: true`

**Request JSON (send exactly this shape):**

```json
{
  "mode": "trf",
  "lab_id": "<LAB_ID>",
  "imagekit_url": "<finalUrl>",
  "catalog": {
    "test_groups": [
      { "id": "uuid", "name": "CBC", "code": "CBC" }
    ],
    "doctors": [
      { "id": "uuid", "name": "Dr. Arjun Mehta" }
    ],
    "accounts": [
      { "id": "uuid", "name": "City Hospital", "code": "CITYH" }
    ],
    "locations": [
      { "id": "uuid", "name": "Main Lab" }
    ]
  },
  "options": {
    "return_normalized_boxes": true,
    "fuzzy_match": true,
    "abbreviation_map": {
      "Na": "Sodium",
      "K": "Potassium",
      "Hb": "Hemoglobin",
      "HCT": "Hematocrit"
    }
  }
}
```

**Expected response JSON (parser spec):**

```json
{
  "patient": {
    "name": "string",
    "age": 30,
    "gender": "Male|Female|Other",
    "phone": "string",
    "email": "string|null"
  },
  "doctor": {
    "name": "string|null",
    "matched_id": "uuid|null",
    "score": 0.0
  },
  "account": {
    "name": "string|null",
    "matched_id": "uuid|null",
    "score": 0.0
  },
  "location": {
    "name": "string|null",
    "matched_id": "uuid|null",
    "score": 0.0
  },
  "requested_tests": [
    {
      "name": "string",
      "code": "string|null",
      "matched_test_group_id": "uuid|null",
      "score": 0.0
    }
  ],
  "dates": {
    "order_date": "YYYY-MM-DD|null",
    "expected_date": "YYYY-MM-DD|null"
  },
  "notes": "string|null",
  "ai_metadata": {
    "objects": [
      { "label": "patient_name", "confidence": 0.95, "bbox": { "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.07 } }
    ],
    "transforms": { "tr": "w-1600,q-85,e-auto-rotate,e-sharpen-50,e-contrast-10,e-grayscale" }
  },
  "confidence": 0.0
}
```

## 5) Create / upsert Patient (server)

Match by **phone** first; fallback to `name + lab_id`.
Table: `public.patients` (required fields exist — supply safe defaults if missing)

* Required columns & fallbacks:

  * `name`: from response, else `'Unknown'`
  * `age`: number or `0`
  * `gender`: `'Male' | 'Female' | 'Other'` (default `'Other'`)
  * `phone`: response or `'0000000000'`
  * `address`: `'Unknown'`
  * `city`: `'Unknown'`
  * `state`: `'Unknown'`
  * `pincode`: `'000000'`
  * `lab_id`: LAB\_ID

If found → reuse `id`. If not → insert and capture `patient_id`.

## 6) Create Order (server)

Table: `public.orders`

* Required fields:

  * `patient_id`: from step 5
  * `patient_name`: patient.name
  * `lab_id`: LAB\_ID
  * `doctor`: string (always fill; if matched doctor found, still set this to doctor.name)
  * `referring_doctor_id`: matched doctor id or `null`
  * `expected_date`: parsed or `CURRENT_DATE`
  * `order_date`: parsed or `CURRENT_DATE`
  * `status`: `'Order Created'`
  * `payment_type`: `'self'` unless matched `account` → `'credit'`
  * `account_id`: matched account id or `null`
  * `location_id`: matched location id or `null`
  * `total_amount`: `0` (will compute later)
  * `color_code`/`color_name`: optional UI defaults
  * `sample_id`: generate unique if you want immediate sample record

Capture `order_id`.

### Link the attachment

`PATCH attachments` where `id = attachment_id`:

* `order_id = order_id`
* `related_id = order_id`
* `patient_id = patient_id`
* `ai_processed = true`
* `ai_confidence = response.confidence`
* `ai_metadata = response.ai_metadata`

## 7) Create Order Tests (server)

For each `requested_tests[]` with `matched_test_group_id`:

* Insert into `order_tests`:

  * `order_id`
  * `test_group_id`
  * `test_name` (use catalog name)
  * `lab_id`: LAB\_ID
* (Optional price) If you plan dynamic pricing later, skip for now or calculate via your pricing rules and create `invoice_items` when billing.

> If **no** matches, store original names in notes or a holding table for manual mapping.

## 8) Return to client

Return a compact payload:

```json
{
  "order": {
    "id": "uuid",
    "patient_id": "uuid",
    "patient_name": "string",
    "status": "Order Created",
    "expected_date": "YYYY-MM-DD",
    "payment_type": "self|credit",
    "account_id": "uuid|null",
    "referring_doctor_id": "uuid|null",
    "location_id": "uuid|null"
  },
  "order_tests": [
    { "id": "uuid", "test_group_id": "uuid", "test_name": "string" }
  ],
  "attachment": {
    "id": "uuid",
    "file_url": "<finalUrl>"
  },
  "unmatched_tests": [
    { "name": "string", "code": "string|null", "score": 0.0 }
  ]
}
```

---

## 9) Validation rules (builder should enforce)

* Must have `LAB_ID`
* ImageKit upload required; only the **transformed URL** should be sent to the function.
* If patient phone missing, still create patient with defaults listed above.
* If doctor/account/location fuzzy score < 0.6 → treat as **unmatched** and don’t set the FK.
* If **no** tests matched, still create the order but return them in `unmatched_tests` for UI review.

---

## 10) Errors & retries

* If the function times out or returns non-JSON, show a “Couldn’t read the form” message and keep the attachment row so the user can re-run from UI.
* Allow the user to override doctor/account/test matches manually and re-run the mapping step without re-uploading.

---

### Notes

* This flow does **not** compute pricing yet. You can add dynamic pricing later (account/location/test-list based) before invoicing.
* All writes use Supabase REST with the service key on the server only.

---

If you want, I can also give you minimal sample code (client upload + server calls) wired to this prompt.
