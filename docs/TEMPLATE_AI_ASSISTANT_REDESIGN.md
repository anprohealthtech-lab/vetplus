# Template AI Assistant Redesign Plan

## Current Problems

### 1. **Bulk Generation Approach**
- Current AI regenerates entire template on each request
- High risk of losing manual edits
- Hard to track what changed
- Overwhelming for users

### 2. **Placeholder Pattern Mismatch**
- Old pattern: `{{Hemoglobin}}`, `{{AFBStainSputum_UNIT}}`
- New pattern: `{{ANALYTE_HB_VALUE}}`, `{{ANALYTE_AFBSTA_UNIT}}`
- AI doesn't know about the new `ANALYTE_[CODE]_[FIELD]` pattern
- Audit validates against wrong patterns

### 3. **Disconnected Tools**
- PlaceholderPicker is separate from AI Assistant
- Audit runs separately, doesn't inform AI
- No incremental workflow

---

## Proposed Solution: Incremental AI Template Builder

### New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED AI SIDEBAR                        │
├─────────────────────────────────────────────────────────────┤
│  [Test Results Tab] [Patient/Lab Tab] [Quick Actions Tab]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ STEP-BY-STEP BUILDER                                │   │
│  │                                                     │   │
│  │ ☑ 1. Patient Info Table     [Insert] [Preview]     │   │
│  │ ☑ 2. Test Results Table     [Insert] [Preview]     │   │
│  │ ☐ 3. Clinical Findings      [Insert] [Preview]     │   │
│  │ ☐ 4. Approval Signature     [Insert] [Preview]     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AI CHAT (Context-Aware)                             │   │
│  │                                                     │   │
│  │ User: Add the AFB Stain result to the table         │   │
│  │                                                     │   │
│  │ AI: I'll add a row for AFB Stain. The placeholders  │   │
│  │     will be:                                        │   │
│  │     - Value: {{ANALYTE_AFBSTA_VALUE}}              │   │
│  │     - Unit: {{ANALYTE_AFBSTA_UNIT}}                │   │
│  │     - Reference: {{ANALYTE_AFBSTA_REFERENCE}}      │   │
│  │                                                     │   │
│  │     [Insert Row] [Show HTML]                        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ LIVE AUDIT STATUS                                   │   │
│  │ ✓ Patient Info: Complete                           │   │
│  │ ⚠ Test Results: Missing WBC, RBC                   │   │
│  │ ✗ Signature: Not added                             │   │
│  │                                                     │   │
│  │ [Fix Missing Items]                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Changes

### 1. **Smart Placeholder Catalog**
Pass the available placeholders to AI so it uses correct patterns:

```typescript
interface AIContext {
  // Available placeholders for this test group
  testGroupAnalytes: Array<{
    label: string;           // "AFB Stain, Sputum"
    code: string;            // "AFBSTA"
    placeholders: {
      value: string;         // "{{ANALYTE_AFBSTA_VALUE}}"
      unit: string;          // "{{ANALYTE_AFBSTA_UNIT}}"
      reference: string;     // "{{ANALYTE_AFBSTA_REFERENCE}}"
      flag: string;          // "{{ANALYTE_AFBSTA_FLAG}}"
    };
    defaultUnit: string;
    defaultReference: string;
  }>;

  // Standard placeholders
  patientPlaceholders: typeof PATIENT_PLACEHOLDER_OPTIONS;
  labPlaceholders: typeof LAB_PLACEHOLDER_OPTIONS;

  // Current template state
  currentHtml: string;
  currentCss: string;
}
```

### 2. **Incremental Actions** (Not Bulk Generation)

Instead of regenerating entire template, AI returns **specific actions**:

```typescript
interface AITemplateAction {
  type: 'insert_table' | 'insert_row' | 'modify_section' | 'add_placeholder' | 'wrap_content';

  // Where to insert (CSS selector or position)
  target?: string;  // e.g., "#results-table tbody" or "after:#patient-info"

  // What to insert
  html?: string;

  // Optional: CSS to add
  css?: string;

  // Human-readable description
  description: string;

  // Affected placeholders (for tracking)
  placeholders?: string[];
}

// Example response from AI
{
  "actions": [
    {
      "type": "insert_row",
      "target": "#results-table tbody",
      "html": "<tr><td>AFB Stain, Sputum</td><td>{{ANALYTE_AFBSTA_VALUE}}</td><td>{{ANALYTE_AFBSTA_UNIT}}</td><td>{{ANALYTE_AFBSTA_REFERENCE}}</td><td>{{ANALYTE_AFBSTA_FLAG}}</td></tr>",
      "description": "Added AFB Stain result row to the results table",
      "placeholders": ["ANALYTE_AFBSTA_VALUE", "ANALYTE_AFBSTA_UNIT", "ANALYTE_AFBSTA_REFERENCE", "ANALYTE_AFBSTA_FLAG"]
    }
  ],
  "summary": "Added 1 analyte row for AFB Stain",
  "warnings": []
}
```

### 3. **Pre-Built Template Blocks**

Instead of AI generating from scratch, use pre-built blocks:

```typescript
const TEMPLATE_BLOCKS = {
  patientInfoTable: {
    name: "Patient Information Table",
    html: `
      <table class="patient-info">
        <tr><td>Patient Name</td><td>{{patientName}}</td></tr>
        <tr><td>Patient ID</td><td>{{patientId}}</td></tr>
        <tr><td>Age / Gender</td><td>{{patientAge}} / {{patientGender}}</td></tr>
        <tr><td>Sample ID</td><td>{{sampleId}}</td></tr>
        <tr><td>Collected On</td><td>{{sampleCollectedAtFormatted}}</td></tr>
        <tr><td>Ref. Doctor</td><td>{{referringDoctorName}}</td></tr>
      </table>
    `,
    requiredPlaceholders: ['patientName', 'patientId', 'patientAge', 'patientGender']
  },

  resultsTableHeader: {
    name: "Test Results Table Header",
    html: `
      <table id="results-table" class="results-table">
        <thead>
          <tr>
            <th>Test Parameter</th>
            <th>Result</th>
            <th>Unit</th>
            <th>Reference Range</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>
          <!-- Analyte rows will be inserted here -->
        </tbody>
      </table>
    `
  },

  analyteRow: (analyte: AnalyteInfo) => ({
    name: `${analyte.label} Row`,
    html: `
      <tr data-analyte="${analyte.code}">
        <td>${analyte.label}</td>
        <td>{{ANALYTE_${analyte.code}_VALUE}}</td>
        <td>{{ANALYTE_${analyte.code}_UNIT}}</td>
        <td>{{ANALYTE_${analyte.code}_REFERENCE}}</td>
        <td class="{{ANALYTE_${analyte.code}_FLAG_CLASS}}">{{ANALYTE_${analyte.code}_FLAG}}</td>
      </tr>
    `,
    requiredPlaceholders: [
      `ANALYTE_${analyte.code}_VALUE`,
      `ANALYTE_${analyte.code}_UNIT`,
      `ANALYTE_${analyte.code}_REFERENCE`,
      `ANALYTE_${analyte.code}_FLAG`
    ]
  }),

  signatureBlock: {
    name: "Approval Signature Block",
    html: `
      <div class="signature-block">
        <img src="{{approverSignature}}" alt="Signature" class="signature-image" />
        <div class="signatory-name">{{approverName}}</div>
        <div class="signatory-role">{{approverRole}}</div>
        <div class="approved-date">{{approvedAtFormatted}}</div>
      </div>
    `,
    requiredPlaceholders: ['approverSignature', 'approverName', 'approverRole']
  },

  clinicalFindings: {
    name: "Clinical Findings Section",
    html: `
      <div class="clinical-section">
        <h3>Clinical Interpretation</h3>
        <div class="findings-content">{{impression}}</div>
      </div>
    `,
    requiredPlaceholders: ['impression']
  }
};
```

### 4. **Live Audit Integration**

Run mini-audit after each change instead of one big audit:

```typescript
interface LiveAuditStatus {
  sections: {
    patientInfo: { complete: boolean; missing: string[] };
    testResults: { complete: boolean; missing: string[]; coverage: number };
    clinicalFindings: { complete: boolean; missing: string[] };
    signature: { complete: boolean; missing: string[] };
  };
  overallStatus: 'complete' | 'partial' | 'minimal';
  suggestions: string[];
}

// Run after each block insertion
function runLiveAudit(html: string, testGroupAnalytes: Analyte[]): LiveAuditStatus {
  const extractedPlaceholders = extractPlaceholders(html);

  return {
    sections: {
      patientInfo: checkPatientInfo(extractedPlaceholders),
      testResults: checkTestResults(extractedPlaceholders, testGroupAnalytes),
      clinicalFindings: checkClinicalFindings(extractedPlaceholders),
      signature: checkSignature(extractedPlaceholders),
    },
    overallStatus: calculateOverallStatus(),
    suggestions: generateSuggestions()
  };
}
```

### 5. **Unified Quick Actions**

Merge PlaceholderPicker's quick actions with AI:

```typescript
// Quick actions panel
const QUICK_ACTIONS = [
  {
    id: 'add-patient-table',
    label: 'Add Patient Info Table',
    icon: 'user-table',
    action: () => insertBlock(TEMPLATE_BLOCKS.patientInfoTable)
  },
  {
    id: 'add-results-table',
    label: 'Add Results Table',
    icon: 'table',
    action: () => insertBlock(TEMPLATE_BLOCKS.resultsTableHeader)
  },
  {
    id: 'add-all-analytes',
    label: 'Add All Test Group Analytes',
    icon: 'list-plus',
    action: () => insertAllAnalyteRows(testGroupAnalytes)
  },
  {
    id: 'add-signature',
    label: 'Add Signature Block',
    icon: 'pen-signature',
    action: () => insertBlock(TEMPLATE_BLOCKS.signatureBlock)
  },
  {
    id: 'add-findings',
    label: 'Add Clinical Findings',
    icon: 'file-text',
    action: () => insertBlock(TEMPLATE_BLOCKS.clinicalFindings)
  }
];
```

---

## Implementation Phases

### Phase 1: Update AI Context (Backend)
1. Modify `template-editor.ts` to accept placeholder catalog
2. Update system prompt to use correct `ANALYTE_[CODE]_[FIELD]` pattern
3. Change response format to return actions instead of full HTML

### Phase 2: Pre-Built Template Blocks
1. Create `templateBlocks.ts` with standard blocks
2. Add "Quick Insert" buttons in sidebar
3. Each block validates placeholders before insertion

### Phase 3: Merge PlaceholderPicker into AI Sidebar
1. Move analyte-centric view into the AI sidebar
2. Add "Insert Analyte Row" action for each analyte
3. Keep right-click to copy placeholder code

### Phase 4: Live Audit Integration
1. Run mini-audit after each insertion
2. Show real-time status in sidebar
3. Highlight missing items with one-click fix

### Phase 5: Conversational AI for Tweaks
1. AI handles styling/layout requests
2. Uses incremental actions (not full regeneration)
3. Knows about available placeholders from context

---

## New User Workflow

1. **Start New Template**
   - Select test group
   - AI sidebar shows available analytes with correct placeholders

2. **Build Structure (Quick Actions)**
   - Click "Add Patient Info Table" → inserts pre-built block
   - Click "Add Results Table" → inserts header with empty tbody
   - Click individual analytes → adds rows one by one
   - Or click "Add All Analytes" → inserts all rows at once

3. **Fine-tune with AI Chat**
   - "Make the header row bold and blue"
   - "Add a horizontal line after the patient info"
   - AI returns targeted CSS/HTML modifications

4. **Live Validation**
   - Sidebar shows: "✓ Patient Info | ✓ 5/5 Analytes | ⚠ Signature Missing"
   - Click "Add Signature" to fix

5. **Final Audit**
   - Run full audit before saving
   - Should pass because blocks used correct placeholders

---

## Benefits

1. **No Lost Work**: Incremental changes, not full regeneration
2. **Correct Placeholders**: AI knows the exact `ANALYTE_[CODE]_[FIELD]` pattern
3. **Faster Workflow**: One-click blocks instead of typing prompts
4. **Real-time Feedback**: Know what's missing as you build
5. **Safer**: Pre-built blocks are guaranteed valid
6. **Flexible**: AI chat available for custom styling needs
