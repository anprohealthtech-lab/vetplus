# Puppeteer PDF Service

Fast PDF generation service using Puppeteer for LIMS v2.

## Features

- ⚡ **Fast PDF Generation** - Browser instance caching (5-minute TTL)
- 🎭 **Real Puppeteer** - Actual Chrome rendering (not PDF.co API)
- 🚀 **DigitalOcean Ready** - Optimized for App Platform deployment
- 🔄 **Auto-warmup** - Browser pre-launched on startup
- 📊 **Performance Metrics** - Detailed timing breakdown
- 🛡️ **Production Ready** - Security, compression, CORS enabled

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "browserActive": true,
  "lastUsed": "2025-11-09T10:30:00.000Z"
}
```

### Warmup Browser
```bash
POST /warmup
```

Response:
```json
{
  "success": true,
  "message": "Browser warmed up",
  "duration": 1234,
  "browserActive": true
}
```

### Generate PDF
```bash
POST /generate-pdf
Content-Type: application/json

{
  "html": "<html><body><h1>Test Report</h1></body></html>",
  "options": {
    "format": "A4",
    "margin": {
      "top": "10mm",
      "right": "10mm",
      "bottom": "10mm",
      "left": "10mm"
    },
    "printBackground": true,
    "landscape": false,
    "scale": 1
  }
}
```

Response:
```json
{
  "success": true,
  "pdf": "base64_encoded_pdf_data...",
  "timing": {
    "browserLaunch": 0,
    "pageLoad": 234,
    "pdfGeneration": 456,
    "total": 690
  }
}
```

## Local Development

### Install Dependencies
```bash
cd puppeteer-service
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Test Locally
```bash
npm start
```

## DigitalOcean App Platform Deployment

### Option 1: Via DigitalOcean Dashboard

1. **Create App**:
   - Go to DigitalOcean Dashboard → Apps
   - Click "Create App"
   - Choose "GitHub" as source
   - Select your repository: `lims-11-9`
   - Choose branch: `bill-dr-location-b2b`

2. **Configure Service**:
   - **Type**: Web Service
   - **Name**: `lims-puppeteer-service`
   - **Source Directory**: `/puppeteer-service`
   - **Build Command**: `npm install && npm run build`
   - **Run Command**: `npm start`
   - **HTTP Port**: `3000`
   - **Instance Size**: Basic (512MB RAM minimum)
   - **Instance Count**: 1

3. **Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=3000` (auto-set by DigitalOcean)

4. **Deploy**:
   - Click "Create Resources"
   - Wait for deployment (~5 minutes)
   - Get your endpoint URL: `https://lims-puppeteer-service-xxxxx.ondigitalocean.app`

### Option 2: Via App Spec YAML

Create `.do/app.yaml`:
```yaml
name: lims-puppeteer-service
services:
  - name: puppeteer-pdf
    source_dir: puppeteer-service
    github:
      repo: dranandnandi/lims-11-9
      branch: bill-dr-location-b2b
      deploy_on_push: true
    build_command: npm install && npm run build
    run_command: npm start
    http_port: 3000
    instance_count: 1
    instance_size_slug: basic-xxs
    envs:
      - key: NODE_ENV
        value: production
    health_check:
      http_path: /health
```

Deploy with CLI:
```bash
doctl apps create --spec .do/app.yaml
```

## Dockerfile (Alternative Deployment)

If you prefer Docker:

```dockerfile
FROM node:18-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

## Testing the Service

### Test Health Check
```bash
curl https://your-app-url.ondigitalocean.app/health
```

### Test Warmup
```bash
curl -X POST https://your-app-url.ondigitalocean.app/warmup
```

### Test PDF Generation
```bash
curl -X POST https://your-app-url.ondigitalocean.app/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Test PDF</h1><p>Generated at: '"$(date)"'</p></body></html>"
  }' \
  | jq -r '.pdf' \
  | base64 -d > test.pdf
```

## Integration with Supabase Edge Function

Once deployed, update the Supabase Edge Function to use your service:

```typescript
const PUPPETEER_SERVICE_URL = 'https://your-app-url.ondigitalocean.app';

// In generate-pdf-puppeteer/index.ts
const response = await fetch(`${PUPPETEER_SERVICE_URL}/generate-pdf`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html, options: { format: 'A4' } }),
});

const { pdf, timing } = await response.json();
const pdfBuffer = Buffer.from(pdf, 'base64');
```

## Performance Expectations

### Cold Start (First Request)
- Browser launch: ~1-2s
- Page load: ~200-500ms
- PDF generation: ~300-500ms
- **Total**: ~2-3s

### Warm Requests (Browser Cached)
- Browser launch: ~0ms (cached)
- Page load: ~200-300ms
- PDF generation: ~300-500ms
- **Total**: ~500-800ms

### Comparison with PDF.co
| Method | Time | Cost |
|--------|------|------|
| PDF.co API | ~5-10s | $0.05/PDF |
| Puppeteer Service | ~0.5-3s | ~$0.001/PDF |

## Monitoring

Check logs in DigitalOcean Dashboard:
- Apps → Your App → Runtime Logs
- Look for: 🚀 Browser launch, ✅ PDF generated, ❌ Errors

## Troubleshooting

### Issue: "Browser launch failed"
**Solution**: Increase instance size to 1GB RAM
```yaml
instance_size_slug: basic-xs  # 1GB RAM
```

### Issue: "Timeout loading HTML"
**Solution**: Increase timeout in server.ts:
```typescript
await page.setContent(html, {
  waitUntil: 'networkidle0',
  timeout: 60000, // Increase to 60s
});
```

### Issue: "Out of memory"
**Solution**: 
1. Close pages after use (already implemented)
2. Reduce browser cache timeout
3. Increase instance RAM

## Cost Estimation

**DigitalOcean Basic Plan**: $5/month
- 512MB RAM
- 1 vCPU
- 1TB bandwidth
- ~10,000 PDFs/month

**vs PDF.co**: $50/month for 1,000 PDFs

**Savings**: 90% cost reduction + 3-5x faster

## Security

- ✅ Helmet.js for security headers
- ✅ CORS enabled for your domain
- ✅ No-sandbox mode (required for Docker)
- ✅ Input validation
- ✅ Request size limits (50MB)
- ✅ Auto-cleanup of browser instances

## Support

For issues or questions:
1. Check DigitalOcean runtime logs
2. Test /health endpoint
3. Verify browser is active
4. Check memory usage
