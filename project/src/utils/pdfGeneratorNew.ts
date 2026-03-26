import { format } from 'date-fns';

// Default lab report template
export const defaultLabTemplate = {
  headerColor: '#1976d2',
  labName: 'Medical Laboratory',
  labAddress: '123 Medical Center Drive',
  labPhone: '(555) 123-4567',
  labEmail: 'lab@medical.com'
};

interface ReportData {
  patient: {
    name: string;
    id: string;
    age: number;
    gender: string;
    referredBy?: string;
  };
  report: {
    reportId: string;
    collectionDate: string;
    reportDate: string;
    reportType: string;
  };
  testResults: Array<{
    parameter: string;
    result: string;
    unit: string;
    referenceRange: string;
    flag?: string;
  }>;
  interpretation?: string;
  template?: typeof defaultLabTemplate;
}

// PDF.co API configuration
const PDFCO_API_KEY = import.meta.env.VITE_PDFCO_API_KEY || '';
const PDFCO_API_URL = 'https://api.pdf.co/v1/pdf/convert/from/html';

export async function generatePDF(data: ReportData): Promise<string> {
  const template = data.template || defaultLabTemplate;
  
  // Generate HTML content
  const html = generateReportHTML(data, template);
  
  try {
    // Try PDF.co API first
    if (PDFCO_API_KEY) {
      const pdfUrl = await generateWithPDFco(html);
      if (pdfUrl) return pdfUrl;
    }
    
    // Fallback to browser print
    return generateWithBrowserPrint(html);
  } catch (error) {
    console.error('PDF generation failed:', error);
    // Final fallback - return HTML blob URL
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }
}

async function generateWithPDFco(html: string): Promise<string | null> {
  try {
    const response = await fetch(PDFCO_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': PDFCO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        html: html,
        name: `report_${Date.now()}.pdf`,
        margins: '10mm',
        paperSize: 'A4',
        printBackground: true,
        header: '',
        footer: '',
        async: false
      })
    });

    if (!response.ok) {
      throw new Error(`PDF.co API error: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.url) {
      return result.url;
    }
    
    throw new Error('No URL in PDF.co response');
  } catch (error) {
    console.warn('PDF.co generation failed:', error);
    return null;
  }
}

function generateWithBrowserPrint(html: string): string {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Failed to open print window');
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Add print styles
  const style = printWindow.document.createElement('style');
  style.textContent = `
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  `;
  printWindow.document.head.appendChild(style);
  
  // Trigger print dialog after content loads
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
  
  return printWindow.location.href;
}

function generateReportHTML(data: ReportData, template: typeof defaultLabTemplate): string {
  const { patient, report, testResults, interpretation } = data;
  
  const flagStyle = (flag?: string) => {
    if (!flag) return '';
    if (flag === 'H') return 'color: red; font-weight: bold;';
    if (flag === 'L') return 'color: orange; font-weight: bold;';
    return '';
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lab Report - ${report.reportId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
    }
    .container {
      width: 210mm;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: ${template.headerColor};
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-section {
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 5px;
    }
    .info-section h3 {
      color: ${template.headerColor};
      margin-bottom: 10px;
      font-size: 16px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .info-label {
      font-weight: bold;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .results-table th {
      background: #f5f5f5;
      padding: 10px;
      text-align: left;
      border: 1px solid #ddd;
      font-weight: bold;
    }
    .results-table td {
      padding: 8px;
      border: 1px solid #ddd;
    }
    .flag-high {
      color: red;
      font-weight: bold;
    }
    .flag-low {
      color: orange;
      font-weight: bold;
    }
    .interpretation {
      margin-top: 30px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .signature-section {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 50px;
      padding-top: 5px;
    }
    @media print {
      .container {
        width: 100%;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${template.labName}</h1>
      <p>${template.labAddress}</p>
      <p>Phone: ${template.labPhone} | Email: ${template.labEmail}</p>
    </div>

    <h2 style="text-align: center; margin-bottom: 20px;">LABORATORY REPORT</h2>

    <div class="info-grid">
      <div class="info-section">
        <h3>Patient Information</h3>
        <div class="info-item">
          <span class="info-label">Name:</span>
          <span>${patient.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Patient ID:</span>
          <span>${patient.id}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Age/Gender:</span>
          <span>${patient.age} years / ${patient.gender}</span>
        </div>
        ${patient.referredBy ? `
        <div class="info-item">
          <span class="info-label">Referred By:</span>
          <span>${patient.referredBy}</span>
        </div>
        ` : ''}
      </div>

      <div class="info-section">
        <h3>Report Information</h3>
        <div class="info-item">
          <span class="info-label">Report ID:</span>
          <span>${report.reportId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Collection Date:</span>
          <span>${format(new Date(report.collectionDate), 'dd/MM/yyyy')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Report Date:</span>
          <span>${format(new Date(report.reportDate), 'dd/MM/yyyy HH:mm')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Report Type:</span>
          <span>${report.reportType}</span>
        </div>
      </div>
    </div>

    <h3 style="margin-bottom: 10px;">Test Results</h3>
    <table class="results-table">
      <thead>
        <tr>
          <th style="width: 40%">Test Parameter</th>
          <th style="width: 20%">Result</th>
          <th style="width: 15%">Unit</th>
          <th style="width: 20%">Reference Range</th>
          <th style="width: 5%">Flag</th>
        </tr>
      </thead>
      <tbody>
        ${testResults.map(test => `
        <tr>
          <td>${test.parameter}</td>
          <td style="${flagStyle(test.flag)}">${test.result}</td>
          <td>${test.unit}</td>
          <td>${test.referenceRange}</td>
          <td class="${test.flag === 'H' ? 'flag-high' : test.flag === 'L' ? 'flag-low' : ''}">${test.flag || ''}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    ${interpretation ? `
    <div class="interpretation">
      <h3>Interpretation</h3>
      <p>${interpretation}</p>
    </div>
    ` : ''}

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">
          <strong>Medical Technologist</strong>
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          <strong>Pathologist</strong>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>This is a computer-generated report. Please correlate clinically.</p>
      <p>Report generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
    </div>
  </div>
</body>
</html>
  `;
}

export { generateReportHTML, generateWithPDFco, generateWithBrowserPrint };
export type { ReportData };
