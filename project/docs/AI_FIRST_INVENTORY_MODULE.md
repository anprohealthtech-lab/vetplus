# AI-First Modular Inventory System

## For Small-Medium Diagnostic Labs

**Philosophy**: Material is 15-25% of lab costs. Don't over-engineer. Let AI do the heavy lifting.

**Version**: 2.0
**Last Updated**: February 2, 2026

---

## Executive Summary

| Metric | Original Plan | This Plan |
|--------|---------------|-----------|
| **Tables** | 14 | **6** |
| **Complexity** | ERP-level | Lab-appropriate |
| **Dev Time** | 12 weeks | **4-6 weeks** |
| **User Input** | Forms & dropdowns | **Voice, Camera, AI** |

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Minimal Clicks** | Voice/camera input, smart defaults, one-tap actions |
| **AI Does the Work** | Parse invoices, suggest quantities, auto-categorize |
| **Modular** | Start with Core, add modules as needed |
| **Lean Database** | 6 tables total (3 core + 3 optional) |
| **No ERP Complexity** | No PO approvals, no GRN workflows, no tax calc |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI LAYER (Claude 3.5 Haiku)                │
│                                                                 │
│  🎤 Voice → Parse    📷 OCR → Extract    💬 NLP → Query        │
│  "Add 5 boxes"       Invoice photo        "What's low?"         │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  CORE MODULE    │  │ CONSUMPTION MOD │  │ PROCUREMENT MOD │
│   (Required)    │  │   (Optional)    │  │   (Optional)    │
│                 │  │                 │  │                 │
│ • Items         │  │ • Test-Item     │  │ • Suppliers     │
│ • Transactions  │  │   Mapping       │  │ • Simple Orders │
│ • Alerts        │  │ • Auto-Consume  │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
      3 tables            1 table              2 tables
```

---

## What We REMOVED (and Why)

| Removed | Why Not Needed for Labs |
|---------|-------------------------|
| `inventory_categories` | Simple `type` column + AI auto-categorization |
| `inventory_batches` | Just track expiry_date on item, not full batch tracking |
| `purchase_order_items` | Store items as JSONB in order - simpler |
| `goods_receipts` | Direct stock update, no GRN workflow |
| `goods_receipt_items` | Not needed |
| `physical_verifications` | Simple adjustment transaction is enough |
| `physical_verification_items` | Not needed |
| `ai_inventory_insights` | Store in item's `ai_data` JSONB field |

---

## Database Schema

### File: `supabase/migrations/20260202_inventory_lean.sql`

### Module Structure

```
CORE (Required) - 3 Tables:
├── inventory_items          -- Master items with stock
├── inventory_transactions   -- All stock movements
└── stock_alerts             -- Auto-generated alerts

OPTIONAL - 3 Tables:
├── inventory_test_mapping   -- Test-item consumption links
├── inventory_suppliers      -- Simple supplier directory
└── inventory_orders         -- Purchase orders (JSONB items)
```

### Table 1: `inventory_items` (Core)

```sql
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL,

  -- Basic Info
  name text NOT NULL,
  code text,                    -- Optional item code
  type text DEFAULT 'consumable',  -- reagent, consumable, calibrator, control, general

  -- Stock
  current_stock numeric DEFAULT 0,
  unit text DEFAULT 'pcs',
  min_stock numeric DEFAULT 0,  -- Alert threshold

  -- Batch & Expiry (AI extracts via OCR)
  batch_number text,            -- Current batch/lot number
  expiry_date date,
  storage_temp text,

  -- CONSUMPTION RULES (for 80-90% accurate auto-consumption)
  consumption_scope text,       -- 'per_test', 'per_sample', 'per_order', 'general', 'manual'
  consumption_per_use numeric,  -- Amount consumed each time (1 tip, 0.5 ml, etc.)
  pack_contains numeric,        -- Tests/uses per pack (20 for TSH kit, NULL for ml-based)

  -- Pricing
  unit_price numeric,

  -- Supplier (denormalized)
  supplier_name text,
  supplier_contact text,

  -- AI Data (flexible JSONB)
  ai_data jsonb DEFAULT '{}',

  -- Meta
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
);
```

### Consumption Rules System

The `consumption_scope`, `consumption_per_use`, and `pack_contains` columns enable **80-90% accurate auto-consumption** without heavy AI computation per transaction.

| Item Type | Example | scope | per_use | pack_contains | Behavior |
|-----------|---------|-------|---------|---------------|----------|
| **General (per sample)** | Vacutainer | `per_sample` | 1 | 100 | 1 tube per sample, pack has 100 |
| **General (per test)** | Pipette Tip | `per_test` | 1 | 1000 | 1 tip per test (all tests), box has 1000 |
| **General (per test)** | Cover Slip | `per_test` | 1 | 100 | 1 slip per test (all tests) |
| **Test-specific (ml)** | CBC Reagent | `per_test` | 0.5 | NULL | 0.5 ml per CBC test, track in ml |
| **Test-specific (kit)** | TSH Kit | `per_test` | 1 | 20 | 1 test per TSH, kit has 20 tests |
| **Sample container** | Urine Container | `per_sample` | 1 | 50 | 1 container per urine sample |
| **Manual only** | Printer Paper | `manual` | NULL | NULL | No auto-consumption |

**How it works:**
- `per_test` + **no mapping**: Consumed for EVERY test (general consumables like tips)
- `per_test` + **with mapping**: Consumed only for MAPPED tests (test-specific reagents)
- `per_sample`: Consumed once per sample collected
- `per_order`: Consumed once per order created
- `manual`: No auto-consumption, manual entry only

**Calculated field**: `tests_remaining = (current_stock × pack_contains) / consumption_per_use`

### Table 2: `inventory_transactions` (Core)

```sql
CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL,
  item_id uuid NOT NULL,

  -- Action
  type text NOT NULL,           -- 'in', 'out', 'adjust'
  quantity numeric NOT NULL,    -- Positive for in, negative for out
  stock_before numeric,
  stock_after numeric,

  -- Context
  reason text,                  -- "Purchase", "Test consumption", "Expired"
  reference text,               -- Invoice number, etc.

  -- Batch info (AI extracts via OCR when adding stock)
  batch_number text,            -- Batch/lot for this transaction
  expiry_date date,             -- Expiry for this batch
  unit_price numeric,           -- Price per unit

  -- For consumption tracking
  order_id uuid,
  result_id uuid,
  test_group_id uuid,

  -- AI input (audit trail)
  ai_input jsonb,               -- Original voice/OCR input

  performed_by uuid,
  created_at timestamptz
);
```

### Table 3: `stock_alerts` (Core)

```sql
CREATE TABLE stock_alerts (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL,
  item_id uuid NOT NULL,

  type text NOT NULL,           -- 'low_stock', 'out_of_stock', 'expiring', 'expired'
  message text NOT NULL,
  current_value numeric,
  threshold_value numeric,

  ai_suggestion text,           -- "Order 5 boxes from XYZ"

  status text DEFAULT 'active', -- 'active', 'dismissed', 'resolved'
  created_at timestamptz
);
```

### Table 4: `inventory_test_mapping` (Optional - Consumption)

```sql
CREATE TABLE inventory_test_mapping (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL,

  -- Can map at test_group OR analyte level (at least one required)
  test_group_id uuid,           -- Map at test level (CBC uses 1 kit)
  analyte_id uuid,              -- Map at analyte level (Hemoglobin uses 0.5ml)
  item_id uuid NOT NULL,

  quantity_per_test numeric DEFAULT 1,
  unit text,

  ai_suggested boolean DEFAULT false,
  ai_confidence numeric,
  ai_reasoning text,

  is_active boolean DEFAULT true,

  -- Constraint: at least one of test_group_id or analyte_id must be set
  CHECK (test_group_id IS NOT NULL OR analyte_id IS NOT NULL)
);
```

**Mapping Levels:**
- **Test Group**: `test_group_id` set, `analyte_id` NULL → Consumes for entire test (e.g., CBC kit)
- **Analyte**: `analyte_id` set → Consumes for specific analyte (e.g., Hemoglobin reagent)

### Table 5: `inventory_suppliers` (Optional - Procurement)

```sql
CREATE TABLE inventory_suppliers (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL,

  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,

  ai_data jsonb DEFAULT '{}',   -- Extracted from invoices
  is_active boolean DEFAULT true
);
```

### Table 6: `inventory_orders` (Optional - Procurement)

```sql
CREATE TABLE inventory_orders (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL,

  order_number text,
  order_date date,
  supplier_id uuid,
  supplier_name text,

  -- Items as JSONB (NO separate table!)
  items jsonb DEFAULT '[]',
  -- Format: [{"item_id": "...", "name": "...", "quantity": 5, "unit": "box", "unit_price": 1000}]

  total_amount numeric,
  status text DEFAULT 'draft',  -- 'draft', 'ordered', 'received', 'cancelled'

  invoice_number text,
  received_at timestamptz,

  ai_parsed jsonb,              -- OCR extracted data

  created_at timestamptz
);
```

### Key Database Functions

```sql
-- Dashboard stats (single query)
SELECT fn_inventory_dashboard_stats(lab_id);
-- Returns: {total_items, out_of_stock, low_stock, expiring_soon, total_value}

-- Quick add from AI input
SELECT fn_inventory_quick_add(lab_id, 'CBC Reagent', 5, 'box', 'Purchase');
-- Auto-creates item if not exists, adds transaction

-- Auto-consume for test (called by edge function)
SELECT fn_inventory_auto_consume(lab_id, order_id, result_id, test_group_id);
-- Creates consumption transactions for all mapped items
```

---

## Edge Functions

### 1. `inventory-ai-input` - Voice/Text/OCR Parser

**File**: `supabase/functions/inventory-ai-input/index.ts`

**Purpose**: Parse natural language input into structured inventory actions.

**Supported Actions**:
| Action | Trigger Words | Example |
|--------|---------------|---------|
| `add_stock` | add, received, got, purchased | "Add 5 boxes CBC reagent" |
| `use_stock` | used, consumed, expired, damaged | "Used 2 controls for QC" |
| `adjust` | adjust, correction, count | "Adjust stock to 10" |
| `query` | show, what, how many, find | "What's running low?" |
| `create_order` | (from OCR invoice) | Parses invoice photo |

**Request**:
```typescript
{
  input: "Add 5 boxes of CBC reagent from Roche",
  inputType: "voice" | "text" | "ocr",
  labId: "uuid",
  existingItems?: [...],  // For better matching
  ocrData?: { fullText: "..." }  // For invoice parsing
}
```

**Response**:
```typescript
{
  success: true,
  parsed: {
    action: "add_stock",
    item_name: "CBC reagent",
    matched_item_id: "uuid",  // If matched to existing
    quantity: 5,
    unit: "box",
    supplier_name: "Roche",
    confidence: 0.95
  },
  requiresConfirmation: true
}
```

### 2. `inventory-auto-consume` - Test Consumption

**File**: `supabase/functions/inventory-auto-consume/index.ts`

**Purpose**: Auto-deduct inventory when test results are saved.

**Trigger**: Called from `ResultsInput.tsx` after successful result save.

**Flow**:
```
Result Saved → Check if Outsourced → Get Test Mappings → Create Transactions → Trigger Alerts
```

**Request**:
```typescript
{
  resultId: "uuid",
  orderId: "uuid",
  testGroupId: "uuid",
  labId: "uuid"
}
```

**Response**:
```typescript
{
  success: true,
  message: "Consumed 3 items",
  itemsConsumed: 3,
  alertsGenerated: 1,
  consumedItems: [
    { itemId: "...", itemName: "CBC Reagent", quantity: 1, newStock: 45 }
  ]
}
```

**Integration Point** (add to `ResultsInput.tsx` after result save):
```typescript
// After successful result save
if (savedResult && !orderTest.outsourced_lab_id) {
  try {
    await supabase.functions.invoke('inventory-auto-consume', {
      body: {
        resultId: savedResult.id,
        orderId: selectedOrder.id,
        testGroupId: selectedTest.test_group_id,
        labId: labId,
      },
    });
  } catch (error) {
    console.error('Auto-consumption failed:', error);
    // Don't block result entry if consumption fails
  }
}
```

---

## AI-First Input Methods

### 1. Voice Input (Primary Method)

**Use Cases**:
```
"Add 5 boxes of CBC reagent"
"Received 10 kits from Roche, invoice ABC123"
"Used 2 controls for QC"
"What's running low?"
"Show items expiring this month"
```

**Implementation** (Browser Web Speech API):
```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.onresult = async (event) => {
  const transcript = event.results[0][0].transcript;

  const { data } = await supabase.functions.invoke('inventory-ai-input', {
    body: {
      input: transcript,
      inputType: 'voice',
      labId,
      existingItems // For better matching
    }
  });

  if (data.parsed.confidence > 0.8) {
    showConfirmationModal(data.parsed);
  } else {
    showClarificationPrompt(data.parsed.clarification_needed);
  }
};
```

### 2. Camera/OCR Input (Invoice Scanning)

**Use Cases**:
- Snap supplier invoice → Auto-create purchase entry
- Photograph reagent box → Extract batch/expiry info

**Implementation**:
```typescript
const processInvoicePhoto = async (imageBase64: string) => {
  // Step 1: OCR with existing vision-ocr function
  const ocrResult = await supabase.functions.invoke('vision-ocr', {
    body: { base64Image: imageBase64, analysisType: 'text' }
  });

  // Step 2: Parse OCR text with AI
  const parsed = await supabase.functions.invoke('inventory-ai-input', {
    body: {
      input: '',
      inputType: 'ocr',
      labId,
      ocrData: { fullText: ocrResult.data.fullText }
    }
  });

  // Step 3: Show confirmation with extracted items
  showInvoiceConfirmation(parsed.data.parsed);
};
```

### 3. Barcode Scanning

```typescript
// Using BarcodeDetector API or quagga.js
const onBarcodeScan = async (barcode: string) => {
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*')
    .or(`code.eq.${barcode},ai_data->barcode.eq.${barcode}`)
    .single();

  if (item) {
    showQuickActionModal(item); // Add / Use / View
  } else {
    showCreateItemPrompt(barcode);
  }
};
```

### 4. Natural Language Queries

```
"Show me items expiring this month"
→ Query: SELECT * FROM inventory_items WHERE expiry_date BETWEEN now() AND now() + '30 days'

"What reagents did we use most last week?"
→ Query: SELECT item_name, SUM(quantity) FROM transactions WHERE type='out' GROUP BY item_id

"Which items need to be ordered?"
→ Query: SELECT * FROM v_inventory_attention WHERE stock_status IN ('low_stock', 'out_of_stock')
```

---

## UI Design: Minimal Clicks

### Main Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  🎤 "Add 5 boxes of reagent..."     [📷 Scan] [⌨️ Type]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️ NEEDS ATTENTION (3)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 CBC Reagent - OUT OF STOCK        [Order] [Dismiss]  │   │
│  │ 🟡 Control Serum - Low (5 left)      [Order] [Dismiss]  │   │
│  │ 🟠 HbA1c Kit expires in 7 days       [Use]   [Dismiss]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📊 QUICK STATS                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │    45    │ │    3     │ │    5     │ │   ₹12K   │          │
│  │  Items   │ │Out Stock │ │ Expiring │ │ Value    │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  RECENT ACTIVITY                                                │
│  • Added 10 boxes CBC Reagent (2 min ago)                      │
│  • Used 1 Control Serum for QC (1 hr ago)                      │
│  • Auto-consumed: CBC test order #1234 (3 hrs ago)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Voice Input Confirmation Modal

```
┌─────────────────────────────────────────┐
│  ✓ AI Understood                  [X]   │
├─────────────────────────────────────────┤
│                                         │
│  🎤 "5 boxes CBC reagent from Roche"    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Action: Add Stock               │   │
│  │ Item: CBC Reagent ✓ (matched)   │   │
│  │ Quantity: 5 boxes               │   │
│  │ Supplier: Roche                 │   │
│  │ Confidence: 95%                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Edit Details]    [✓ Confirm]          │
│                                         │
└─────────────────────────────────────────┘
```

### Invoice Scanner Result

```
┌─────────────────────────────────────────┐
│  📷 Invoice Scanned               [X]   │
├─────────────────────────────────────────┤
│                                         │
│  Supplier: ABC Diagnostics              │
│  Invoice #: INV-2024-001                │
│                                         │
│  Items Found:                           │
│  ☑ CBC Reagent (5 box) - ₹5,000        │
│  ☑ Control Serum (10 ml) - ₹2,000      │
│  ☐ Pipette Tips (1000 pcs) - ₹500      │
│                                         │
│  Total: ₹7,500                          │
│                                         │
│  [Add All to Stock]  [Save as Order]    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Foundation (Week 1-2)

**Database**:
- [ ] Apply migration `20260202_inventory_lean.sql`
- [ ] Test RLS policies
- [ ] Verify triggers work (stock update, alerts)

**UI**:
- [ ] Create `/inventory` page with dashboard
- [ ] Implement `InventoryDashboard.tsx`
- [ ] Implement `InventoryItemsList.tsx`
- [ ] Implement `InventoryItemForm.tsx`
- [ ] Basic manual stock in/out

**API**:
- [ ] Add inventory methods to `supabase.ts`

### Phase 2: AI Input (Week 2-3)

**Edge Functions**:
- [ ] Deploy `inventory-ai-input` function
- [ ] Test voice parsing
- [ ] Test text parsing

**UI**:
- [ ] Add voice input button (Web Speech API)
- [ ] Add confirmation modal
- [ ] Add natural language search

### Phase 3: Camera/OCR (Week 3-4)

**Features**:
- [ ] Invoice photo capture
- [ ] OCR integration (existing `vision-ocr`)
- [ ] AI parsing of OCR text
- [ ] Barcode scanning (optional)

**UI**:
- [ ] Camera capture component
- [ ] Invoice review/confirmation modal

### Phase 4: Auto-Consumption (Week 4-5)

**Edge Functions**:
- [ ] Deploy `inventory-auto-consume` function
- [ ] Test with sample orders

**Integration**:
- [ ] Add test-item mapping UI
- [ ] AI-suggested mappings
- [ ] Integrate with `ResultsInput.tsx`

**UI**:
- [ ] Test-item mapping configuration page
- [ ] Consumption history view

### Phase 5: Optional Modules (Week 5-6)

**Procurement** (if needed):
- [ ] Suppliers list
- [ ] Simple purchase orders
- [ ] Order from alert flow

**Reports**:
- [ ] Stock report
- [ ] Consumption report
- [ ] Expiry report

---

## File Structure

```
src/
├── pages/
│   └── Inventory.tsx                    # Main inventory page
│
├── components/
│   └── Inventory/
│       ├── InventoryDashboard.tsx       # Dashboard with stats & alerts
│       ├── InventoryItemsList.tsx       # Items table/list
│       ├── InventoryItemForm.tsx        # Add/edit item modal
│       ├── InventoryQuickAdd.tsx        # Voice/text quick add
│       ├── InventoryAlerts.tsx          # Alerts panel
│       ├── InventoryVoiceInput.tsx      # Voice input component
│       ├── InventoryInvoiceScanner.tsx  # Camera + OCR
│       ├── InventoryTestMapping.tsx     # Test-item mapping config
│       └── InventoryTransactions.tsx    # Transaction history
│
supabase/
├── migrations/
│   └── 20260202_inventory_lean.sql      # Database schema
│
└── functions/
    ├── inventory-ai-input/
    │   └── index.ts                     # Voice/text/OCR parser
    └── inventory-auto-consume/
        └── index.ts                     # Auto-consumption on result
```

---

## Environment Setup

### Required Secrets

```bash
# Anthropic API for Claude (AI parsing)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Google Cloud Vision (for OCR) - already configured
# ALLGOOGLE_KEY or GOOGLE_CLOUD_API_KEY
```

### Deploy Edge Functions

```bash
supabase functions deploy inventory-ai-input
supabase functions deploy inventory-auto-consume
```

---

## Cost Analysis

| Component | Monthly Cost (Est.) |
|-----------|---------------------|
| Claude API (Haiku) | $5-15 (based on usage) |
| Google Vision OCR | Already included |
| Supabase Edge Functions | Included in plan |

**Total**: ~$10-20/month for AI features

---

## Summary: Why This Approach?

### For Lab Owners
- ✅ **Faster data entry**: Speak instead of type
- ✅ **Less errors**: AI validates and matches
- ✅ **Auto-tracking**: Consumption happens automatically
- ✅ **Proactive alerts**: Know before you run out

### For Developers
- ✅ **Less code**: 6 tables vs 14
- ✅ **Simpler logic**: No approval workflows
- ✅ **AI handles complexity**: Parsing, matching, categorizing
- ✅ **Faster to build**: 4-6 weeks vs 12 weeks

### What This Is NOT
- ❌ Not an ERP system
- ❌ Not for manufacturing
- ❌ Not for complex procurement
- ❌ Not for detailed cost accounting

**It's a practical, AI-powered inventory helper for diagnostic labs.**

---

*Document Version: 2.0*
*Migration File: `20260202_inventory_lean.sql`*
*Edge Functions: `inventory-ai-input`, `inventory-auto-consume`*
