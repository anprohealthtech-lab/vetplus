# Deploy DigitalOcean Function for Placeholder Search

## Setup

1. **Install DigitalOcean CLI** (if not already installed):
```bash
# Windows (via Chocolatey)
choco install doctl

# Or download from: https://github.com/digitalocean/doctl/releases
```

2. **Authenticate**:
```bash
doctl auth init
```

3. **Create serverless namespace** (one-time):
```bash
doctl serverless install
doctl serverless connect
```

## Deploy

```bash
cd digitalocean-bot
doctl serverless deploy .
```

## Test the Function

```bash
# Via doctl
doctl serverless functions invoke search-placeholders -p userQuery:"show hemoglobin value" -p labId:"2f8d0329-d584-4423-91f6-9ab326b700ae"

# Via curl (replace URL with your deployed function URL)
curl -X POST https://faas-blr1-8177d592.doserverless.co/api/v1/web/fn-xxxxx/search-placeholders \
  -H "Content-Type: application/json" \
  -d '{"userQuery": "show glucose level", "labId": "2f8d0329-d584-4423-91f6-9ab326b700ae"}'
```

## Agent Integration

Once deployed, configure your agent to use this function as a tool:

```javascript
// Agent tool definition
{
  name: "search_placeholders",
  description: "Search for report template placeholders using natural language. Use this when the user asks about adding test results, values, flags, or units to a report template.",
  parameters: {
    userQuery: {
      type: "string",
      description: "Natural language query describing what placeholder is needed (e.g., 'show hemoglobin value', 'glucose flag', 'CBC results')"
    },
    labId: {
      type: "string",
      description: "UUID of the lab"
    }
  },
  endpoint: "https://faas-blr1-8177d592.doserverless.co/api/v1/web/fn-xxxxx/search-placeholders"
}
```

## Response Format

```json
{
  "success": true,
  "query": "show hemoglobin value",
  "suggestions": [
    {
      "placeholder": "{{ANALYTE_HEMOGLOBIN_VALUE}}",
      "displayName": "Hemoglobin (Value)",
      "confidence": 0.89,
      "context": "Part of Complete Blood Count test",
      "category": "hematology",
      "unit": "g/dL",
      "referenceRange": "12.0 - 16.0",
      "exampleValue": "14.5",
      "insertHtml": "<p>Hemoglobin: {{ANALYTE_HEMOGLOBIN_VALUE}} g/dL</p>"
    }
  ],
  "count": 1
}
```

## Environment Variables

Set in DigitalOcean Functions dashboard or via CLI:

```bash
doctl serverless functions env set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```
