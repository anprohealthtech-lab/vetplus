# Optimized Sample Management Implementation Plan
## Using Existing Schema

## Current Schema Analysis

### ✅ EXISTING TABLES (Already in Database)

#### 1. **`samples` table** (Lines 1536-1563)
```sql
CREATE TABLE public.samples (
  id text PRIMARY KEY,                      -- Sample ID (string, not UUID!)
  order_id uuid REFERENCES orders(id),      -- Link to order
  sample_type text,                         -- "Blood", "Urine", etc.
  barcode text UNIQUE,                      -- Barcode for machine scanning
  container_type text,                      -- Tube type
  specimen_site text,
  lab_id uuid REFERENCES labs(id),
  status sample_status DEFAULT 'created',   -- Lifecycle status
  collected_at timestamptz,
  received_at timestamptz,
  processed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  collected_by uuid REFERENCES users(id),
  collected_at_location_id uuid REFERENCES locations(id),
  current_location_id uuid REFERENCES locations(id),
  destination_location_id uuid REFERENCES locations(id),
  transit_status text DEFAULT 'at_collection_point',
  created_at timestamptz DEFAULT now()
);
```

**Status:** ✅ **ALREADY EXISTS** - No need to create!

#### 2. **`order_test_groups` table** (Lines 924-934)
```sql
CREATE TABLE public.order_test_groups (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  test_group_id uuid REFERENCES test_groups(id),
  test_name varchar NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Status:** ✅ **ALREADY EXISTS** - Can link to samples!

#### 3. **`order_tests` table** (Lines 935-959)
```sql
CREATE TABLE public.order_tests (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  test_name varchar NOT NULL,
  test_group_id uuid REFERENCES test_groups(id),
  sample_id text,                           -- ✅ Already has sample_id field!
  invoice_id uuid,
  is_billed boolean DEFAULT false,
  lab_id uuid REFERENCES labs(id),
  price numeric,
  outsourced_lab_id uuid,
  -- ... other fields
);
```

**Status:** ✅ **ALREADY EXISTS** - Already has `sample_id` field!

#### 4. **`test_groups` table** (Lines 1628-1650+)
```sql
CREATE TABLE public.test_groups (
  id uuid PRIMARY KEY,
  name varchar NOT NULL,
  code varchar NOT NULL,
  category varchar NOT NULL,
  sample_type sample_type NOT NULL,        -- ✅ Defines required sample
  sample_color varchar DEFAULT 'Red',      -- ✅ Tube color!
  -- ... other fields
);
```

**Status:** ✅ **ALREADY EXISTS** - Defines sample requirements!

#### 5. **`sample_transits` table** (Lines 1495-1535)
```sql
CREATE TABLE public.sample_transits (
  id uuid PRIMARY KEY,
  lab_id uuid REFERENCES labs(id),
  sample_id text REFERENCES samples(id),   -- ✅ Already linked!
  order_id uuid REFERENCES orders(id),
  from_location_id uuid REFERENCES locations(id),
  to_location_id uuid REFERENCES locations(id),
  status text DEFAULT 'pending_dispatch',
  tracking_barcode text,
  -- ... transit tracking fields
);
```

**Status:** ✅ **ALREADY EXISTS** - Sample transit tracking ready!

---

## What's Missing vs What We Have

| Feature | Current Status | Action Needed |
|---------|---------------|---------------|
| Sample registry | ✅ `samples` table exists | **Use it!** |
| Sample barcode | ✅ `samples.barcode` exists | Generate barcodes |
| Sample type tracking | ✅ `samples.sample_type` exists | Populate from `test_groups` |
| Link samples to tests | ❌ Missing | **ADD:** `sample_id` to `order_test_groups` |
| Sample QR codes | ❌ Missing column | **ADD:** `qr_code_data` to `samples` |
| Sample lifecycle events | ❌ No audit table | **ADD:** `sample_events` table (optional) |

---

## Minimal Changes Required

### Change #1: Add `sample_id` to `order_test_groups`
**Why:** Link each test group to its required sample

```sql
-- Migration: Add sample_id to order_test_groups
ALTER TABLE public.order_test_groups 
ADD COLUMN sample_id text REFERENCES samples(id);

CREATE INDEX idx_order_test_groups_sample_id ON order_test_groups(sample_id);

COMMENT ON COLUMN order_test_groups.sample_id IS 
  'Reference to the physical sample tube required for this test group';
```

### Change #2: Add `qr_code_data` to `samples`
**Why:** Store QR code payload for comprehensive sample info

```sql
-- Migration: Add QR code support to samples
ALTER TABLE public.samples 
ADD COLUMN qr_code_data jsonb;

CREATE INDEX idx_samples_qr_code ON samples USING GIN (qr_code_data);

COMMENT ON COLUMN samples.qr_code_data IS 
  'QR code payload containing sample metadata for mobile scanning';
```

### Change #3: Create `sample_events` table (Optional but Recommended)
**Why:** Audit trail for sample lifecycle (machine scans, status changes)

```sql
-- Migration: Create sample events audit trail
CREATE TABLE public.sample_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id text NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'collected', 'received', 'scanned', 
    'loaded_to_machine', 'processed', 'quality_check', 
    'rejected', 'discarded'
  )),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES users(id),
  location_id uuid REFERENCES locations(id),
  machine_id text,                      -- Analyzer/machine identifier
  notes text,
  metadata jsonb,                       -- Event-specific data
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sample_events_sample_id ON sample_events(sample_id);
CREATE INDEX idx_sample_events_event_type ON sample_events(event_type);
CREATE INDEX idx_sample_events_event_timestamp ON sample_events(event_timestamp);

COMMENT ON TABLE sample_events IS 
  'Audit trail for sample lifecycle events including machine integration';
```

---

## Workflow: How It Works

### Phase 1: Order Creation → Sample Generation

```typescript
// services/sampleService.ts
export async function createSamplesForOrder(
  orderId: string,
  orderTestGroups: { id: string; test_group_id: string }[],
  labId: string,
  patientId: string
): Promise<Sample[]> {
  const samples: Sample[] = [];
  
  // Group test groups by required sample type
  const sampleTypeGroups = new Map<string, typeof orderTestGroups>();
  
  for (const otg of orderTestGroups) {
    // Get test group to determine sample requirements
    const { data: testGroup } = await supabase
      .from('test_groups')
      .select('sample_type, sample_color')
      .eq('id', otg.test_group_id)
      .single();
    
    const sampleType = testGroup?.sample_type || 'Blood';
    
    if (!sampleTypeGroups.has(sampleType)) {
      sampleTypeGroups.set(sampleType, []);
    }
    sampleTypeGroups.get(sampleType)!.push(otg);
  }
  
  // Create ONE sample per unique sample type
  const labCode = await getLabCode(labId);
  
  for (const [sampleType, testGroups] of sampleTypeGroups.entries()) {
    // Generate unique sample ID (format: LIMSLAB-20260101-0001-BLD)
    const sampleId = await generateSampleId(labCode, sampleType);
    
    // Generate barcode (Code 128)
    const barcode = generateBarcode(sampleId);
    
    // Generate QR code data
    const qrData = {
      sampleId,
      type: sampleType,
      patientId,
      orderId,
      date: new Date().toISOString(),
      lab: labCode
    };
    
    // Get tube color from first test group
    const { data: firstTestGroup } = await supabase
      .from('test_groups')
      .select('sample_color')
      .eq('id', testGroups[0].test_group_id)
      .single();
    
    // Insert sample
    const { data: sample, error } = await supabase
      .from('samples')
      .insert({
        id: sampleId,                           // Use generated ID as primary key
        order_id: orderId,
        sample_type: sampleType,
        barcode,
        qr_code_data: qrData,
        container_type: getTubeType(sampleType), // "EDTA", "SST", etc.
        lab_id: labId,
        status: 'created'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Link this sample to all test groups that need it
    for (const otg of testGroups) {
      await supabase
        .from('order_test_groups')
        .update({ sample_id: sample.id })
        .eq('id', otg.id);
    }
    
    // Create event
    await supabase.from('sample_events').insert({
      sample_id: sample.id,
      event_type: 'created',
      metadata: { test_groups: testGroups.map(t => t.id) }
    });
    
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
  const { error } = await supabase
    .from('samples')
    .update({
      status: 'collected',
      collected_at: new Date().toISOString(),
      collected_by: collectedBy,
      collected_at_location_id: locationId
    })
    .eq('id', sampleId);
  
  if (error) throw error;
  
  // Log event
  await supabase.from('sample_events').insert({
    sample_id: sampleId,
    event_type: 'collected',
    performed_by: collectedBy,
    location_id: locationId
  });
}
```

### Phase 3: Machine Integration (Barcode Scan)

```typescript
export async function scanSampleBarcode(
  barcodeData: string,
  machineId: string
): Promise<SampleWorklistInfo> {
  // Lookup sample by barcode or ID
  const { data: sample, error } = await supabase
    .from('samples')
    .select(`
      *,
      order_test_groups!inner(
        id,
        test_name,
        test_groups!inner(
          name,
          test_group_analytes(
            analytes(*)
          )
        )
      )
    `)
    .or(`barcode.eq.${barcodeData},id.eq.${barcodeData}`)
    .single();
  
  if (error || !sample) {
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
    event_type: 'loaded_to_machine',
    machine_id: machineId,
    notes: `Sample loaded into ${machineId}`
  });
  
  // Return worklist info for machine
  return {
    sampleId: sample.id,
    sampleType: sample.sample_type,
    testGroups: sample.order_test_groups.map(otg => ({
      name: otg.test_groups.name,
      analytes: otg.test_groups.test_group_analytes.map(tga => ({
        name: tga.analytes.name,
        code: tga.analytes.code,
        loincCode: tga.analytes.loinc_code
      }))
    }))
  };
}
```

---

## Sample ID Generation

### Format: `{LAB_CODE}-{YYYYMMDD}-{SEQ:04d}-{TYPE_CODE}`

```typescript
// utils/sampleIdGenerator.ts
const SAMPLE_TYPE_CODES: Record<string, string> = {
  'Blood': 'BLD',
  'Serum': 'SRM',
  'Plasma': 'PLM',
  'Urine': 'URN',
  'Stool': 'STL',
  'Sputum': 'SPT',
  'CSF': 'CSF',
  'Swab': 'SWB'
};

export async function generateSampleId(
  labCode: string,
  sampleType: string,
  date: Date = new Date()
): Promise<string> {
  const dateStr = format(date, 'yyyyMMdd');
  const typeCode = SAMPLE_TYPE_CODES[sampleType] || 'UNK';
  
  // Get daily sequence
  const { data, error } = await supabase
    .from('samples')
    .select('id')
    .like('id', `${labCode}-${dateStr}-%`)
    .order('created_at', { ascending: false })
    .limit(1);
  
  let sequence = 1;
  if (data && data.length > 0) {
    const parts = data[0].id.split('-');
    sequence = parseInt(parts[2]) + 1;
  }
  
  return `${labCode}-${dateStr}-${sequence.toString().padStart(4, '0')}-${typeCode}`;
}

// Example: "LIMSLAB-20260101-0001-URN"
```

### Barcode Generation (Code 128)

```typescript
// utils/barcodeGenerator.ts
import JsBarcode from 'jsbarcode';

export function generateBarcode(sampleId: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, sampleId, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: true,
    fontSize: 12,
    margin: 10
  });
  return canvas.toDataURL('image/png');
}
```

### QR Code Generation

```typescript
// utils/qrCodeGenerator.ts
import QRCode from 'qrcode';

export async function generateSampleQRCode(sample: {
  id: string;
  sampleType: string;
  patientId: string;
  orderId: string;
}): Promise<string> {
  const qrData = {
    sampleId: sample.id,
    type: sample.sampleType,
    patientId: sample.patientId,
    orderId: sample.orderId,
    timestamp: new Date().toISOString()
  };
  
  return await QRCode.toDataURL(JSON.stringify(qrData), {
    width: 200,
    margin: 1
  });
}
```

---

## UI Components

### Sample Collection Tracker
```tsx
// components/Samples/SampleCollectionTracker.tsx
export const SampleCollectionTracker: React.FC<{ orderId: string }> = ({ orderId }) => {
  const [samples, setSamples] = useState<Sample[]>([]);
  
  useEffect(() => {
    fetchSamples();
  }, [orderId]);
  
  const fetchSamples = async () => {
    const { data } = await supabase
      .from('samples')
      .select('*')
      .eq('order_id', orderId);
    setSamples(data || []);
  };
  
  const handleCollect = async (sampleId: string) => {
    await collectSample(sampleId, currentUser.id, currentLocation.id);
    await fetchSamples();
  };
  
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Samples Required</h3>
      {samples.map(sample => (
        <div key={sample.id} className="flex items-center gap-3 p-3 border rounded">
          <SampleTypeIndicator 
            sampleType={sample.sample_type}
            size="md"
          />
          <div className="flex-1">
            <div className="font-mono font-bold">{sample.id}</div>
            <div className="text-sm text-gray-600">{sample.sample_type}</div>
          </div>
          <div>
            {sample.status === 'created' ? (
              <button onClick={() => handleCollect(sample.id)} className="btn-success">
                Mark Collected
              </button>
            ) : (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Collected
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Sample Label Printer
```tsx
// components/Samples/SampleLabelPrinter.tsx
export const SampleLabelPrinter: React.FC<{ sample: Sample }> = ({ sample }) => {
  const [barcode, setBarcode] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  
  useEffect(() => {
    setBarcode(generateBarcode(sample.id));
    generateSampleQRCode(sample).then(setQrCode);
  }, [sample]);
  
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Sample Label - ${sample.id}</title>
          <style>
            @page { size: 3in 2in; margin: 0; }
            body { font-family: monospace; text-align: center; padding: 8px; }
            .barcode { margin: 8px 0; }
            .qr { margin: 4px 0; }
            .sample-id { font-size: 16px; font-weight: bold; }
            .meta { font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          <div class="sample-id">${sample.id}</div>
          <div class="barcode">
            <img src="${barcode}" width="220" height="60" />
          </div>
          <div class="qr">
            <img src="${qrCode}" width="80" height="80" />
          </div>
          <div class="meta">${sample.sample_type} | ${sample.container_type}</div>
          <div class="meta">${new Date(sample.created_at).toLocaleString()}</div>
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

---

## Migration Strategy

### Step 1: Update Schema (Minimal Changes)
```sql
-- File: 20260101_add_sample_management.sql

-- 1. Add sample_id to order_test_groups
ALTER TABLE public.order_test_groups 
ADD COLUMN sample_id text REFERENCES samples(id);

CREATE INDEX idx_order_test_groups_sample_id ON order_test_groups(sample_id);

-- 2. Add qr_code_data to samples
ALTER TABLE public.samples 
ADD COLUMN qr_code_data jsonb;

CREATE INDEX idx_samples_qr_code ON samples USING GIN (qr_code_data);

-- 3. Create sample_events table
CREATE TABLE public.sample_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id text NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES users(id),
  location_id uuid REFERENCES locations(id),
  machine_id text,
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sample_events_sample_id ON sample_events(sample_id);
```

### Step 2: Update Order Creation Logic
- Modify `OrderForm` to call `createSamplesForOrder()` after creating order
- Auto-generate samples based on test group requirements

### Step 3: Update Collection Workflow
- Add `SampleCollectionTracker` to OrderDetailsModal
- Allow marking individual samples as collected

### Step 4: Machine Integration (Future)
- Implement barcode scanning interface
- Add machine communication layer (HL7/ASTM)

---

## Implementation Checklist

- [ ] Run migration: Add `sample_id` to `order_test_groups`
- [ ] Run migration: Add `qr_code_data` to `samples`
- [ ] Run migration: Create `sample_events` table
- [ ] Implement `sampleService.ts` with CRUD operations
- [ ] Implement `sampleIdGenerator.ts`
- [ ] Implement `barcodeGenerator.ts`
- [ ] Implement `qrCodeGenerator.ts`
- [ ] Create `SampleCollectionTracker` component
- [ ] Create `SampleLabelPrinter` component
- [ ] Update `OrderForm` to auto-create samples
- [ ] Update `OrderDetailsModal` to show samples
- [ ] Add sample management to Dashboard
- [ ] Install barcode/QR libraries: `jsbarcode`, `qrcode`, `react-barcode`
- [ ] Write tests for sample generation logic
- [ ] Create documentation for machine integration

---

## Key Benefits of This Approach

✅ **Minimal Schema Changes**: Only 3 small alterations, no new major tables  
✅ **Uses Existing Infrastructure**: Leverages `samples`, `order_test_groups`, `test_groups`  
✅ **No Data Migration**: Works alongside existing data  
✅ **Machine-Ready**: Barcode/QR generation for analyzer integration  
✅ **Flexible**: Supports multiple samples per order (Urine + Blood, etc.)  
✅ **Audit Trail**: `sample_events` tracks entire lifecycle  
✅ **Location Tracking**: Built-in transit support via `sample_transits`  

---

## Next Steps

1. **Review this plan** - Confirm it aligns with your requirements
2. **Run migrations** - Add 3 small schema changes
3. **Implement services** - Create sample generation logic
4. **Build UI** - Add sample tracking to order workflow
5. **Test** - Verify sample creation and collection
6. **Machine integration** - Future phase with HL7 support

**Ready to proceed?** I can start creating the migration files now.
