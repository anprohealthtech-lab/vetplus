import express, { Request, Response } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));

// Browser instance cache
let browserInstance: Browser | null = null;
let lastUsed = Date.now();
let activeRequests = 0; // Track active PDF generation requests
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface PDFRequest {
  html: string;
  options?: {
    format?: 'A4' | 'Letter' | 'Legal';
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
    landscape?: boolean;
    scale?: number;
  };
}

interface PDFResponse {
  success: boolean;
  pdf?: string; // base64
  error?: string;
  timing?: {
    browserLaunch?: number;
    pageLoad?: number;
    pdfGeneration?: number;
    total: number;
  };
}

// Get or create browser instance
async function getBrowser(): Promise<Browser> {
  const now = Date.now();
  
  // Close browser if idle for too long AND no active requests
  if (browserInstance && now - lastUsed > BROWSER_IDLE_TIMEOUT && activeRequests === 0) {
    console.log('♻️ Closing idle browser instance');
    try {
      await browserInstance.close();
    } catch (err) {
      console.warn('⚠️ Error closing browser:', err);
    }
    browserInstance = null;
  }

  // Launch new browser if needed
  if (!browserInstance) {
    const launchStart = Date.now();
    console.log('🚀 Launching new Puppeteer browser...');
    console.log('📍 PUPPETEER_CACHE_DIR =', process.env.PUPPETEER_CACHE_DIR);
    
    try {
      // Log executable path for debugging
      const execPath = puppeteer.executablePath();
      console.log('📍 Chrome executable path:', execPath);
    } catch (err) {
      console.warn('⚠️ Could not determine executablePath:', err);
    }
    
    browserInstance = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
      ],
    });
    
    const launchTime = Date.now() - launchStart;
    console.log(`✅ Browser launched in ${launchTime}ms`);
  }

  lastUsed = now;
  return browserInstance;
}

// Cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Terminating...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    browserActive: browserInstance !== null,
    lastUsed: new Date(lastUsed).toISOString(),
  });
});

// Warmup endpoint - pre-launch browser
app.post('/warmup', async (req: Request, res: Response) => {
  try {
    const start = Date.now();
    await getBrowser();
    const duration = Date.now() - start;
    
    res.json({
      success: true,
      message: 'Browser warmed up',
      duration,
      browserActive: true,
    });
  } catch (error) {
    console.error('Warmup failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Warmup failed',
    });
  }
});

// Generate PDF endpoint
app.post('/generate-pdf', async (req: Request, res: Response) => {
  const totalStart = Date.now();
  let page: Page | null = null;

  // Increment active requests counter
  activeRequests++;
  console.log(`📊 Active requests: ${activeRequests}`);

  try {
    const { html, options = {} }: PDFRequest = req.body;

    if (!html) {
      activeRequests--;
      return res.status(400).json({
        success: false,
        error: 'HTML content is required',
      });
    }

    console.log(`📄 Generating PDF (${html.length} bytes)`);

    // Get browser instance
    const browserStart = Date.now();
    const browser = await getBrowser();
    const browserTime = Date.now() - browserStart;

    // Create new page
    const pageStart = Date.now();
    page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      deviceScaleFactor: 2, // High quality rendering
    });

    // Load HTML content with longer timeout for complex documents
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 60000, // Increased from 30s to 60s
    });
    const pageLoadTime = Date.now() - pageStart;

    // Generate PDF
    const pdfStart = Date.now();
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      printBackground: options.printBackground ?? true,
      margin: options.margin || {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
      landscape: options.landscape || false,
      scale: options.scale || 1,
      preferCSSPageSize: false,
      timeout: 60000, // Add timeout for PDF generation
    });
    const pdfGenTime = Date.now() - pdfStart;

    // Close page safely
    if (page) {
      try {
        await page.close();
      } catch (closeErr) {
        console.warn('⚠️ Error closing page (non-fatal):', closeErr);
      }
      page = null;
    }

    const totalTime = Date.now() - totalStart;

    console.log(`✅ PDF generated in ${totalTime}ms (browser: ${browserTime}ms, load: ${pageLoadTime}ms, pdf: ${pdfGenTime}ms)`);

    // Decrement active requests counter
    activeRequests--;
    console.log(`📊 Active requests: ${activeRequests}`);

    // Return PDF as base64
    const response: PDFResponse = {
      success: true,
      pdf: pdfBuffer.toString('base64'),
      timing: {
        browserLaunch: browserTime,
        pageLoad: pageLoadTime,
        pdfGeneration: pdfGenTime,
        total: totalTime,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    
    // Decrement active requests counter on error
    activeRequests--;
    console.log(`📊 Active requests after error: ${activeRequests}`);
    
    // Cleanup page if still open
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.warn('⚠️ Failed to close page (non-fatal):', e);
      }
    }

    const response: PDFResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'PDF generation failed',
      timing: {
        total: Date.now() - totalStart,
      },
    };

    res.status(500).json(response);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎭 Puppeteer PDF Service running on port ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /warmup - Pre-launch browser`);
  console.log(`   POST /generate-pdf - Generate PDF from HTML`);
});

// Warmup browser on startup (optional)
setTimeout(async () => {
  try {
    console.log('🔥 Warming up browser on startup...');
    await getBrowser();
    console.log('✅ Browser ready for requests');
  } catch (error) {
    console.error('Warmup failed:', error);
  }
}, 1000);
