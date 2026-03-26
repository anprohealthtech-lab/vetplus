# Sample Management & Barcode System - Research & Implementation Plan

## Executive Summary
Currently, the LIMS system has sample tracking at the **order level** (one sample per order). However, this doesn't align with real-world laboratory workflows where:
- **One order can require multiple sample types** (e.g., Urine for Urine Routine + Blood/EDTA for HbA1c)
- Each physical sample needs its own unique barcode/QR code for tracking
- Laboratory machines need to scan individual sample tubes, not orders

This document outlines a comprehensive redesign to implement **order-test-level sample tracking** for proper machine integration.

---

## Current System Analysis

### Current Schema (Order-Level Tracking)
```sql
-- orders table (ONE sample per order)
CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  sample_id text UNIQUE,              -- e.g., "31-Dec-2025-001"
  color_code text,                     -- e.g., "#EF4444" (Red)
  color_name text,                     -- e.g., "Red"
  qr_code_data text,                   -- JSON with order info
  tube_barcode text,                   -- Physical barcode
  sample_collected_at timestamptz,
  sample_collected_by text,
  -- ... other order fields
);

-- order_tests table (tests in an order)
CREATE TABLE public.order_tests (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  test_group_id uuid REFERENCES test_groups(id),
  sample_id text,                      -- ❌ Currently unused/null
  -- ... other fields
);

-- test_groups table (defines sample requirements)
CREATE TABLE public.test_groups (
  id uuid PRIMARY KEY,
  name text,
  sample_type text,                    -- "Blood", "Urine", "Serum", etc.
  sample_color text,                   -- Custom color code
  -- ... other fields
);
```

### Problems with Current Approach
1. **❌ One order → One sample ID**: If an order has 2 tests requiring different samples (Urine + Blood), both share ONE sample ID
2. **❌ No individual sample tracking**: Cannot track when individual samples are collected
3. **❌ Machine integration impossible**: Lab machines scan tubes, not orders
4. **❌ Unused `samples` table**: No proper sample management workflow
5. **❌ Color collision**: Multiple test groups may need the same tube type (e.g., both CBC and HbA1c use Purple/EDTA tube)

---

## Industry Standards & Best Practices

### 1. Barcode Standards for Laboratory Samples

#### **ISBT 128** (International Standard)
- Used globally for blood and biological samples
- Format: `=A99<DIN>B&<DONATION_ID>C&<PRODUCT_CODE>...`
- Example: `=A9912345B&W1234567C&E0123`

#### **Code 128** (Most Common)
- High-density barcode
- Can encode all ASCII characters
- Used by most laboratory equipment
- Example: `LAB-2025-001-URN` or `LAB-2025-001-BLD`

#### **QR Codes** (Supplementary)
- Can store more data (up to 4,296 alphanumeric characters)
- Good for patient identification and error reduction
- Not directly machine-readable by most analyzers
- Use case: Patient verification, sample routing

### 2. Sample ID Generation Patterns

#### **WHO Recommendations**
- Globally unique identifiers
- Include: Lab code, Date, Sequence, Sample type
- Format: `{LAB}-{YYYYMMDD}-{SEQ}-{TYPE}`
- Example: `LIMSLAB-20251231-001-URN`

#### **CLSI Guidelines** (Clinical & Laboratory Standards Institute)
- Patient ID linkage
- Traceable through entire lifecycle
- Include check digits for validation

### 3. Tube Color Coding (Standard Vacutainer System)

| Color | Additive | Tests |
|-------|----------|-------|
| **Red** | None (Clot) | Serum chemistry, hormones, antibodies |
| **Purple/Lavender** | EDTA | CBC, HbA1c, blood typing |
| **Green** | Heparin | Plasma chemistry |
| **Blue** | Sodium Citrate | Coagulation studies |
| **Yellow/Gold** | SST (Serum Separator) | Thyroid, liver function |
| **Gray** | Fluoride/Oxalate | Glucose |

### 4. Machine Integration Requirements

Modern lab analyzers (e.g., Sysmex, Beckman Coulter, Roche) require:
- **Unique sample barcodes** (Code 128 or Code 39)
- **Sample type information** (often in barcode data or separate field)
- **Patient ID linkage** (for result mapping)
- **Bidirectional LIS communication** (HL7/ASTM protocols)

---

## Proposed Solution: Order-Test-Level Sample Tracking

### New Schema Design

```sql
-- ============================================
-- SAMPLES TABLE (Main sample registry)
-- ============================================
CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES labs(id),
  
  -- Unique Identifiers
  sample_id text NOT NULL UNIQUE,           -- "LIMSLAB-20251231-001-URN"
  barcode text NOT NULL UNIQUE,             -- Code 128 barcode data
  qr_code_data jsonb,                       -- QR code payload (JSON)
  
  -- Sample Metadata
  sample_type text NOT NULL,                -- "Urine", "Blood", "Serum"
  tube_type text,                           -- "EDTA", "SST", "Plain"
  tube_color_code text,                     -- "#9333EA" (Purple)
  tube_color_name text,                     -- "Purple"
  volume_ml numeric,                        -- Expected volume
  
  -- Collection Info
  collected_at timestamptz,
  collected_by uuid REFERENCES users(id),
  collected_at_location_id uuid REFERENCES locations(id),
  
  -- Status Tracking
  status text NOT NULL DEFAULT 'pending'    -- pending, collected, received, processing, consumed, discarded
    CHECK (status IN ('pending', 'collected', 'in_transit', 'received', 'processing', 'consumed', 'discarded', 'rejected')),
  rejection_reason text,
  rejected_at timestamptz,
  rejected_by uuid REFERENCES users(id),
  
  -- Quality Control
  quality_status text DEFAULT 'acceptable'  -- acceptable, hemolyzed, clotted, insufficient
    CHECK (quality_status IN ('acceptable', 'hemolyzed', 'clotted', 'insufficient', 'contaminated')),
  quality_notes text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Indexes
  CONSTRAINT samples_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_samples_sample_id ON samples(sample_id);
CREATE INDEX idx_samples_barcode ON samples(barcode);
CREATE INDEX idx_samples_status ON samples(status);
CREATE INDEX idx_samples_collected_at ON samples(collected_at);

-- ============================================
-- SAMPLE_ORDER_TESTS (Link samples to tests)
-- ============================================
CREATE TABLE public.sample_order_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  order_test_id uuid NOT NULL REFERENCES order_tests(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Which patient does this sample belong to?
  patient_id uuid NOT NULL REFERENCES patients(id),
  
  -- Priority for this specific test on this sample
  priority text DEFAULT 'normal' 
    CHECK (priority IN ('stat', 'urgent', 'normal', 'low')),
  
  -- Sample-specific notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(sample_id, order_test_id)  -- One sample can't be linked to same test twice
);

CREATE INDEX idx_sample_order_tests_sample_id ON sample_order_tests(sample_id);
CREATE INDEX idx_sample_order_tests_order_id ON sample_order_tests(order_id);

-- ============================================
-- UPDATE order_tests to reference samples
-- ============================================
ALTER TABLE public.order_tests 
ADD COLUMN assigned_sample_id uuid REFERENCES samples(id);

-- ============================================
-- Sample Lifecycle Events (Audit Trail)
-- ============================================
CREATE TABLE public.sample_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  event_type text NOT NULL 
    CHECK (event_type IN ('created', 'collected', 'received', 'scanned', 'loaded', 'processed', 'rejected', 'discarded')),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES users(id),
  location_id uuid REFERENCES locations(id),
  machine_id text,                      -- For machine integration
  notes text,
  metadata jsonb                        -- Additional event data
);

CREATE INDEX idx_sample_events_sample_id ON sample_events(sample_id);
CREATE INDEX idx_sample_events_event_type ON sample_events(event_type);
```

---

## Sample ID Generation Strategy

### Format: `{LAB_CODE}-{YYYYMMDD}-{SEQ:04d}-{TYPE}`

**Examples:**
- `LIMSLAB-20251231-0001-URN` (Urine sample)
- `LIMSLAB-20251231-0002-BLD` (Blood sample)
- `LIMSLAB-20251231-0003-SRM` (Serum sample)

### Sample Type Codes
```typescript
const SAMPLE_TYPE_CODES: Record<string, string> = {
  'Urine': 'URN',
  'Blood': 'BLD',
  'Serum': 'SRM',
  'Plasma': 'PLM',
  'Stool': 'STL',
  'Sputum': 'SPT',
  'CSF': 'CSF',
  'Swab': 'SWB',
  // Add more as needed
};
```

### Barcode Generation Function
```typescript
// utils/sampleBarcodeGenerator.ts
import JsBarcode from 'jsbarcode';

export interface SampleBarcodeData {
  sampleId: string;
  sampleType: string;
  patientId: string;
  orderId: string;
  collectionDate: string;
}

export function generateSampleBarcode(data: SampleBarcodeData): string {
  // Generate Code 128 barcode
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, data.sampleId, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: true,
    fontSize: 12,
    margin: 10
  });
  
  return canvas.toDataURL('image/png');
}

export function generateSampleQRCode(data: SampleBarcodeData): string {
  const qrData = {
    sampleId: data.sampleId,
    type: data.sampleType,
    patientId: data.patientId,
    orderId: data.orderId,
    date: data.collectionDate,
    lab: 'LIMSLAB'
  };
  
  return QRCode.toDataURL(JSON.stringify(qrData));
}

export async function generateSampleId(
  labCode: string,
  sampleType: string,
  date: Date = new Date()
): Promise<string> {
  const dateStr = format(date, 'yyyyMMdd');
  const typeCode = SAMPLE_TYPE_CODES[sampleType] || 'UNK';
  
  // Get daily sequence from database
  const { data, error } = await supabase
    .from('samples')
    .select('sample_id')
    .like('sample_id', `${labCode}-${dateStr}-%`)
    .order('created_at', { ascending: false })
    .limit(1);
  
  let sequence = 1;
  if (data && data.length > 0) {
    const lastId = data[0].sample_id;
    const parts = lastId.split('-');
    sequence = parseInt(parts[2]) + 1;
  }
  
  return `${labCode}-${dateStr}-${sequence.toString().padStart(4, '0')}-${typeCode}`;
}
```

---

## Integration Workflow

### Phase 1: Sample Generation (Order Creation)
```typescript
// services/sampleService.ts
export async function createSamplesForOrder(
  orderId: string,
  orderTests: OrderTest[],
  labId: string,
  patientId: string
): Promise<Sample[]> {
  // Group tests by required sample type
  const sampleGroups = new Map<string, OrderTest[]>();
  
  for (const test of orderTests) {
    const testGroup = await getTestGroup(test.test_group_id);
    const sampleType = testGroup.sample_type || 'Blood';
    
    if (!sampleGroups.has(sampleType)) {
      sampleGroups.set(sampleType, []);
    }
    sampleGroups.get(sampleType)!.push(test);
  }
  
  // Create one sample per unique sample type
  const samples: Sample[] = [];
  const labCode = await getLabCode(labId);
  
  for (const [sampleType, tests] of sampleGroups.entries()) {
    const sampleId = await generateSampleId(labCode, sampleType);
    const barcodeData = {
      sampleId,
      sampleType,
      patientId,
      orderId,
      collectionDate: new Date().toISOString()
    };
    
    const barcode = await generateSampleBarcode(barcodeData);
    const qrCode = await generateSampleQRCode(barcodeData);
    
    // Get tube color from test group
    const testGroup = await getTestGroup(tests[0].test_group_id);
    
    const { data: sample, error } = await supabase
      .from('samples')
      .insert({
        lab_id: labId,
        sample_id: sampleId,
        barcode: barcode,
        qr_code_data: barcodeData,
        sample_type: sampleType,
        tube_color_code: testGroup.sample_color || getStandardTubeColor(sampleType),
        tube_color_name: getStandardTubeColorName(sampleType),
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Link sample to all tests that need it
    for (const test of tests) {
      await supabase.from('sample_order_tests').insert({
        sample_id: sample.id,
        order_test_id: test.id,
        order_id: orderId,
        patient_id: patientId
      });
      
      // Update order_tests to reference this sample
      await supabase
        .from('order_tests')
        .update({ assigned_sample_id: sample.id })
        .eq('id', test.id);
    }
    
    samples.push(sample);
  }
  
  return samples;
}
```

### Phase 2: Sample Collection
```typescript
export async function collectSample(
  sampleId: string,
  collectedBy: string,
  locationId: string
): Promise<void> {
  await supabase
    .from('samples')
    .update({
      status: 'collected',
      collected_at: new Date().toISOString(),
      collected_by: collectedBy,
      collected_at_location_id: locationId
    })
    .eq('id', sampleId);
  
  // Create event
  await supabase.from('sample_events').insert({
    sample_id: sampleId,
    event_type: 'collected',
    performed_by: collectedBy,
    location_id: locationId
  });
}
```

### Phase 3: Machine Integration (Barcode Scanning)
```typescript
export async function processMachineScan(
  barcodeData: string,
  machineId: string
): Promise<SampleInfo> {
  // Lookup sample by barcode
  const { data: sample } = await supabase
    .from('samples')
    .select(`
      *,
      sample_order_tests(
        order_tests(
          test_name,
          test_groups(name, analytes(*))
        )
      )
    `)
    .eq('sample_id', barcodeData)
    .single();
  
  if (!sample) {
    throw new Error('Sample not found');
  }
  
  // Update status
  await supabase
    .from('samples')
    .update({ status: 'processing' })
    .eq('id', sample.id);
  
  // Log machine load event
  await supabase.from('sample_events').insert({
    sample_id: sample.id,
    event_type: 'loaded',
    machine_id: machineId,
    notes: `Sample loaded into ${machineId}`
  });
  
  return {
    sampleId: sample.sample_id,
    sampleType: sample.sample_type,
    tests: sample.sample_order_tests.map(sot => sot.order_tests.test_name),
    analytes: sample.sample_order_tests.flatMap(
      sot => sot.order_tests.test_groups.analytes
    )
  };
}
```

---

## UI Components

### 1. Sample Label Printer
```tsx
// components/Samples/SampleLabelPrinter.tsx
export const SampleLabelPrinter: React.FC<{ sample: Sample }> = ({ sample }) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Sample Label - ${sample.sample_id}</title>
          <style>
            @page { size: 3in 2in; margin: 0; }
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 5px;
            }
            .barcode { margin: 10px 0; }
            .sample-id { 
              font-size: 14px; 
              font-weight: bold; 
              font-family: monospace;
            }
            .patient-info { font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="sample-id">${sample.sample_id}</div>
          <div class="barcode">
            <img src="${sample.barcode}" width="200" height="60" />
          </div>
          <div class="patient-info">${sample.patient_name} | ${sample.sample_type}</div>
          <div style="margin-top: 5px; font-size: 8px;">
            ${new Date(sample.created_at).toLocaleString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };
  
  return (
    <button onClick={handlePrint} className="btn-primary">
      <Printer className="h-4 w-4 mr-2" />
      Print Label
    </button>
  );
};
```

### 2. Sample Collection Tracker
```tsx
// components/Samples/SampleCollectionTracker.tsx
export const SampleCollectionTracker: React.FC<{ orderId: string }> = ({ orderId }) => {
  const [samples, setSamples] = useState<Sample[]>([]);
  
  useEffect(() => {
    fetchOrderSamples();
  }, [orderId]);
  
  const fetchOrderSamples = async () => {
    const { data } = await supabase
      .from('sample_order_tests')
      .select('samples(*)')
      .eq('order_id', orderId);
    setSamples(data?.map(sot => sot.samples) || []);
  };
  
  const handleCollect = async (sampleId: string) => {
    await collectSample(sampleId, currentUser.id, currentLocation.id);
    await fetchOrderSamples();
  };
  
  return (
    <div className="sample-tracker">
      <h3>Samples Required</h3>
      {samples.map(sample => (
        <div key={sample.id} className="sample-card">
          <SampleTypeIndicator 
            sampleType={sample.sample_type}
            sampleColor={sample.tube_color_code}
          />
          <div className="sample-info">
            <div className="font-mono font-bold">{sample.sample_id}</div>
            <div className="text-sm text-gray-600">{sample.sample_type}</div>
          </div>
          <div className="sample-status">
            {sample.status === 'pending' ? (
              <button onClick={() => handleCollect(sample.id)} className="btn-success">
                Mark Collected
              </button>
            ) : (
              <CheckCircle className="text-green-600" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## Migration Strategy

### Step 1: Create New Tables (Non-Breaking)
- Add `samples` table
- Add `sample_order_tests` table
- Add `sample_events` table
- Keep existing `orders.sample_id` for backward compatibility

### Step 2: Data Migration
- For each existing order:
  - Determine sample types needed (from order_tests → test_groups)
  - Create corresponding sample records
  - Link samples to order_tests

### Step 3: Update Application Logic
- Order creation → Create samples
- Sample collection → Update sample status
- Machine integration → Scan sample barcodes

### Step 4: Deprecation (Future)
- Remove `orders.sample_id`, `color_code`, `qr_code_data` columns
- Update all views and queries

---

## Machine Integration Specifications

### Supported Protocols
1. **HL7 v2.x** (Most common)
2. **ASTM E1394** (Older systems)
3. **Custom REST API** (Modern systems)

### Example HL7 Message (Order Request)
```
MSH|^~\&|LIS|LIMSLAB|ANALYZER|SYSMEX|20251231120000||ORM^O01|12345|P|2.5
PID|1||PAT001^^^LIMSLAB||Doe^John||19900101|M
OBR|1||LIMSLAB-20251231-0001-BLD|CBC^Complete Blood Count|||20251231120000
OBX|1|ST|WBC||||||||||
OBX|2|ST|RBC||||||||||
OBX|3|ST|HGB||||||||||
```

### Example Result Upload (Reverse)
```
MSH|^~\&|ANALYZER|SYSMEX|LIS|LIMSLAB|20251231121000||ORU^R01|54321|P|2.5
PID|1||PAT001^^^LIMSLAB||Doe^John||19900101|M
OBR|1||LIMSLAB-20251231-0001-BLD|CBC^Complete Blood Count|||20251231120000|||||||20251231121000||DR123
OBX|1|NM|WBC^White Blood Count||7.5|10^9/L|4.5-11.0||||F
OBX|2|NM|RBC^Red Blood Count||5.2|10^12/L|4.5-5.9||||F
OBX|3|NM|HGB^Hemoglobin||15.2|g/dL|13.5-17.5||||F
```

---

## Recommended Libraries

### Barcode Generation
- **JsBarcode** (Code 128): https://github.com/lindell/JsBarcode
- **react-barcode**: React wrapper for JsBarcode

### QR Code
- **qrcode** (Node.js): https://github.com/soldair/node-qrcode
- **react-qr-code**: React component

### Printing
- **react-to-print**: Print React components
- **jsPDF**: Generate PDF labels

### HL7 Integration (Future)
- **simple-hl7**: HL7 parsing/generation
- **node-hl7-complete**: Full HL7 v2.x support

---

## Implementation Checklist

- [ ] Create migration for `samples` table
- [ ] Create migration for `sample_order_tests` table
- [ ] Create migration for `sample_events` table
- [ ] Implement `sampleService.ts` with CRUD operations
- [ ] Implement `sampleBarcodeGenerator.ts`
- [ ] Create `SampleLabelPrinter` component
- [ ] Create `SampleCollectionTracker` component
- [ ] Update `OrderForm` to auto-create samples
- [ ] Update `OrderDetailsModal` to show sample list
- [ ] Create sample management dashboard
- [ ] Implement barcode scanning interface
- [ ] Add sample quality control workflow
- [ ] Create sample audit trail view
- [ ] Write unit tests for sample service
- [ ] Write integration tests for barcode generation
- [ ] Create user documentation
- [ ] Create API documentation for machine integration

---

## Conclusion

This comprehensive sample management system:
✅ Supports multiple samples per order
✅ Generates unique barcodes for each sample
✅ Tracks sample lifecycle (pending → collected → processed → consumed)
✅ Enables machine integration via barcode scanning
✅ Maintains proper audit trails
✅ Follows industry standards (Code 128, HL7)
✅ Supports quality control workflows

**Next Steps**: Review this plan, confirm requirements, and begin implementation with Phase 1 (table creation).
