# LIMS v2 - AI Copilot Instructions

## Project Overview

This is a Laboratory Information Management System (LIMS) v2 built with **React/TypeScript + Vite**, featuring multi-lab support, AI-powered workflows, mobile capabilities via **Capacitor**, and sophisticated PDF/report generation.

**Key Stack**:
- **Frontend**: React 18.3, TypeScript, Vite, Tailwind CSS
- **Mobile**: Capacitor 7 (Android)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **PDF Generation**: Puppeteer (report PDFs) + PDF.co (invoice PDFs)
- **AI/ML**: Gemini 2.0 Flash, Anthropic Claude 3.5 Haiku, Google Generative AI
- **Workflows**: Survey.js 1.9.x
- **Integration**: WhatsApp Business API (via DigitalOcean proxy)
- **Editor**: CKEditor 5 (invoice/report templates)
- **Deployment**: Netlify (frontend), Supabase Edge Functions, DigitalOcean (WhatsApp backend)

## Critical Architectural Patterns

### 1. Centralized Data Access Layer (src/utils/supabase.ts)

**ABSOLUTE RULE: Always use the `database` object, never `supabase.from(...)` directly.**

This ~11K line file is the "brain" of the application. It exports a `database` namespace with typed methods for all operations:
- `patients`, `orders`, `results`, `invoices`, `payments`, `labs`, `users`, `doctors`, `locations`, `testWorkflowMap`, `workflows`, `workflowVersions`, `aiProtocols`

Each namespace includes methods like `.getAll()`, `.getById()`, `.create()`, `.update()`, with built-in lab-scoped filtering and error handling.

```typescript
// ❌ WRONG - breaks lab isolation
const { data } = await supabase.from('orders').select('*');

// ✅ CORRECT - respects lab context
const { data, error } = await database.orders.getAll();
const lab_id = await database.getCurrentUserLabId();
const { data } = await database.results.getByOrderId(order_id);
```

### 2. Multi-Lab Architecture (Lab Scoping)

Every data operation must respect lab boundaries. This is NOT optional:
- Users belong to exactly ONE lab (`users.lab_id`)
- All queries automatically filter by current user's lab via `database.getCurrentUserLabId()`
- `lab_analytes` table (lab-specific test parameters) overrides global `analytes`
- Test group configurations, workflows, and branding are lab-scoped

The lab context is managed in `src/contexts/AuthContext.tsx`:
```typescript
const lab_id = await database.getCurrentUserLabId();
if (!lab_id) throw new Error('No lab context - check auth');
```

### 3. Edge Function Communication Patterns

The codebase uses Supabase Edge Functions (Deno) for:
- PDF generation (`generate-pdf-letterhead`, `generate-pdf-puppeteer`)
- AI processing (`process-workflow-results`, `ai-test-configurator`, `ai-document-processor`)
- Invoice PDF generation (`generate-invoice-pdf`)
- TRF extraction (`process-trf`)

**Invocation pattern** (from components):
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* payload */ }
});
```

**Key functions location**: `supabase/functions/[function-name]/index.ts`

**Important**: 40+ Edge Functions exist in `supabase/functions/`. Use `supabase functions serve` locally to test.

### 4. Multi-Provider PDF Generation

The system uses two PDF providers based on complexity:

**Puppeteer Service** (`/puppeteer-service`):
- Complex report PDFs with dynamic layouts
- Deployed separately on DigitalOcean
- Environment: `VITE_USE_PUPPETEER=true` (default)
- Endpoint: Makes HTTP POST to external Puppeteer service
- Files: `src/utils/pdfServicePuppeteer.ts`

**PDF.co**:
- Simple invoices (via Edge Function `generate-invoice-pdf`)
- Fallback for complex reports if Puppeteer unavailable
- API Key stored securely in Edge Function secrets
- Files: `src/utils/pdfService.ts`, `supabase/functions/generate-invoice-pdf/`

**Generation flow**:
1. `buildReportHtmlBundle()` or `buildInvoiceHtml()` creates HTML+CSS
2. For reports: Calls Puppeteer service directly; For invoices: Calls Edge Function
3. Edge Function/Service renders and uploads to Supabase Storage
4. Returns public URL for download/WhatsApp sharing

### 5. Workflow System (Survey.js)

Workflows are multi-step forms for result entry, sample collection, etc.

**Components**:
- `src/components/Workflow/FlowManager.tsx`: Orchestrates form flow
- `src/components/Workflow/WorkflowRunner.tsx`: Executes Survey.js forms
- Survey schemas stored in `workflows` and `workflow_versions` tables

**Data flow**:
Survey.js JSON schema → Form UI → User submission → Edge Function (`process-workflow-results`) → AI processing → Results saved to DB

**Key file**: `supabase/functions/process-workflow-results/index.ts` (~1400 lines) - Processes submitted workflow data, extracts analyte values, calls Gemini for AI interpretation.

### 6. Netlify Functions (Proxy Layer)

Netlify functions (`/netlify/functions/`) act as CORS proxies for external services:

**WhatsApp Integration**:
- Functions: `whatsapp-send-message.js`, `whatsapp-send-document.js`, `send-report.js`
- These proxy calls to external WhatsApp backend (DigitalOcean)
- Client code: `src/utils/whatsappAPI.ts`
- Environment: `VITE_WHATSAPP_API_BASE_URL` points to DigitalOcean backend
- Header: `X-API-Key` for authentication

**Template Editor**:
- Function: `netlify/functions/template-editor.js`
- Calls Gemini 2.0 Flash to generate/modify invoice/report HTML templates
- Uses `ALLGOOGLE_KEY` or `GEMINI_API_KEY` env var

## Build & Deployment

### Local Development
```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint check
```

### Edge Functions (Local Testing)
```bash
supabase functions serve          # Serve all functions locally
supabase functions serve [name]   # Serve specific function
supabase functions deploy [name]  # Deploy to Supabase
```

### Android/Mobile
```bash
npm run android:sync    # Build + copy to android/
npm run android:run     # Sync + run on device
npm run android:open    # Open Android Studio
```

### Deployment
- **Frontend**: Netlify (`npm run deploy:prod`)
- **Edge Functions**: Supabase (via CLI or dashboard)
- **Puppeteer Service**: DigitalOcean App Platform (separate Node.js app)
- **Secrets**: Set via `supabase secrets set KEY=value` for Edge Functions

## Component Organization & Patterns

### Directory Structure
- `src/components/[Domain]/`: Domain components (Patients/, Orders/, Results/, etc.)
- `src/components/ui/`: Reusable UI atoms (Button, Modal, Form, etc.)
- `src/components/Workflow/`: Survey.js workflow components
- `src/pages/`: Individual page routes
- `src/emails/`: React Email templates for PDF generation
- `src/utils/`: Utilities (supabase.ts, pdfService.ts, whatsappAPI.ts, etc.)
- `src/contexts/`: React Context providers (AuthContext.tsx)
- `supabase/functions/`: Edge Functions (Deno)

### Common Patterns

**Using Auth Context** (in components):
```typescript
import { useAuth } from '../contexts/AuthContext';

export function MyComponent() {
  const { user, labStatus, labName } = useAuth();
  if (!user) return <div>Loading...</div>;
  return <div>Welcome, {labName}</div>;
}
```

**Accessing Database** (in components):
```typescript
import { database } from '../utils/supabase';

async function loadOrders() {
  const { data, error } = await database.orders.getAll();
  if (error) {
    console.error('Failed to load orders:', error);
    return;
  }
  setOrders(data);
}
```

**AI Function Integration** (for template generation):
```typescript
// Client calls Edge Function
const { data } = await supabase.functions.invoke('ai-test-configurator', {
  body: { testName: 'Complete Blood Count', lab_id: labId }
});
```

## File Upload & Storage

Use `generateFilePath()` for organized Supabase Storage paths:
```typescript
import { uploadFile, generateFilePath } from '../utils/supabase';

const filePath = generateFilePath(
  'document.pdf',
  patientId,
  labId,
  'reports'  // Creates: reports/[labId]/[patientId]_[timestamp]_document.pdf
);

const { publicUrl } = await uploadFile(file, filePath);
```

## Key Files Reference

- **src/utils/supabase.ts**: Core database API (10,999 lines) - THE MOST IMPORTANT FILE
- **src/contexts/AuthContext.tsx**: User/lab context, session management
- **src/utils/pdfService.ts**: Report HTML generation and PDF.co integration
- **src/utils/pdfServicePuppeteer.ts**: Puppeteer service HTTP calls
- **src/utils/whatsappAPI.ts**: WhatsApp integration client
- **src/utils/geminiAI.ts**: AI utility functions
- **supabase/functions/process-workflow-results/index.ts**: Workflow result processing + AI
- **supabase/functions/generate-invoice-pdf/index.ts**: Secure invoice PDF generation
- **netlify/functions/template-editor.js**: Gemini-powered template generation
- **src/components/Workflow/FlowManager.tsx**: Workflow orchestration
- **.env.example**: All required environment variables

## Environment Variables (See .env.example)

**Critical variables**:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Supabase project
- `VITE_USE_PUPPETEER=true`: Use Puppeteer for reports (default)
- `VITE_WHATSAPP_API_BASE_URL`: WhatsApp backend (DigitalOcean)
- `ALLGOOGLE_KEY` or `GEMINI_API_KEY`: Gemini API key
- `VITE_CUSTOM_STORAGE_DOMAIN`: Optional branded PDF URLs

**Edge Function secrets** (set via `supabase secrets set`):
- `PDFCO_API_KEY`: PDF.co API key
- `GEMINI_API_KEY`: For Edge Functions
- `ALLGOOGLE_KEY`: Alternative Gemini key
