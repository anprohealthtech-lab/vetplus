// PDF Generation utilities using PDF.co API with HTML templates
export interface LabTemplate {
  id: string;
  name: string;
  header: {
    labName: string;
    address: string;
    phone: string;
    email: string;
    logo?: string;
  };
  footer: {
    signature: string;
    authorizedBy: string;
    disclaimer?: string;
  };
  styling: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
}

export interface PatientInfo {
  name: string;
  id: string;
  age: number;
  gender: string;
  referredBy: string;
}

export interface ReportDetails {
  reportId: string;
  collectionDate: string;
  reportDate: string;
  reportType: string;
}

export interface TestResult {
  parameter: string;
  result: string;
  unit: string;
  referenceRange: string;
  flag?: string;
}

export interface ReportData {
  patient: PatientInfo;
  report: ReportDetails;
  testResults: TestResult[];
  interpretation: string;
  template: LabTemplate;
}

// Default lab template
export const defaultLabTemplate: LabTemplate = {
  id: 'medilab-default',
  name: 'MediLab Diagnostics Default',
  header: {
    labName: 'MediLab Diagnostics',
    address: '123 Health Street, Medical District, City - 560001',
    phone: '+91 80 1234 5678',
    email: 'reports@medilab.com',
  },
  footer: {
    signature: 'Digital Signature',
    authorizedBy: 'Dr. Sarah Wilson, MD',
    disclaimer: 'This report is generated electronically and is valid without signature.',
  },
  styling: {
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    fontFamily: 'Arial, sans-serif',
  },
};

// Save/Load lab templates
export const saveLabTemplate = (template: LabTemplate): void => {
  try {
    const templates = getLabTemplates();
    const updatedTemplates = templates.filter(t => t.id !== template.id);
    updatedTemplates.push(template);
    localStorage.setItem('lims_lab_templates', JSON.stringify(updatedTemplates));
  } catch (error) {
    console.error('Error saving lab template:', error);
  }
};

export const getLabTemplates = (): LabTemplate[] => {
  try {
    const templates = localStorage.getItem('lims_lab_templates');
    return templates ? JSON.parse(templates) : [defaultLabTemplate];
  } catch (error) {
    console.error('Error loading lab templates:', error);
    return [defaultLabTemplate];
  }
};

export const getLabTemplate = (id: string): LabTemplate => {
  const templates = getLabTemplates();
  return templates.find(t => t.id === id) || defaultLabTemplate;
};

// Universal HTML Template for LIMS Report (as specified)
const generateUniversalHTMLTemplate = (data: ReportData): string => {
  const { patient, report, testResults, interpretation, template } = data;
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: ${template.styling.fontFamily}; 
      padding: 30px; 
      margin: 0;
      color: #333;
      line-height: 1.4;
    }
    .header, .footer { 
      text-align: center; 
      font-size: 12px; 
      color: ${template.styling.secondaryColor};
    }
    .header {
      border-bottom: 2px solid ${template.styling.primaryColor};
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .footer {
      border-top: 1px solid ${template.styling.secondaryColor};
      padding-top: 15px;
      margin-top: 30px;
    }
    h1 { 
      text-align: center; 
      margin: 20px 0 5px 0;
      color: ${template.styling.primaryColor};
      font-size: 24px;
      font-weight: bold;
    }
    h2 {
      color: ${template.styling.primaryColor};
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
      border-bottom: 1px solid ${template.styling.primaryColor};
      padding-bottom: 5px;
    }
    .section { 
      margin-top: 20px; 
      page-break-inside: avoid;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }
    .info-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid ${template.styling.primaryColor};
    }
    .info-title {
      font-weight: bold;
      color: ${template.styling.primaryColor};
      margin-bottom: 10px;
      font-size: 14px;
    }
    .info-item {
      margin: 5px 0;
      font-size: 12px;
    }
    .info-label {
      font-weight: bold;
      display: inline-block;
      width: 100px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 10px;
      page-break-inside: avoid;
    }
    th, td { 
      border: 1px solid #ccc; 
      padding: 8px; 
      text-align: left;
      font-size: 12px;
    }
    th {
      background: ${template.styling.primaryColor};
      color: white;
      font-weight: bold;
      text-align: center;
    }
    td {
      text-align: center;
    }
    td:first-child {
      text-align: left;
      font-weight: 500;
    }
    .result-value {
      font-weight: bold;
    }
    .flag-h {
      color: #dc3545;
      font-weight: bold;
    }
    .flag-l {
      color: #0066cc;
      font-weight: bold;
    }
    .flag-c {
      color: #ff6600;
      font-weight: bold;
    }
    .title { 
      font-size: 18px; 
      font-weight: bold; 
      margin-top: 10px;
      color: ${template.styling.primaryColor};
    }
    .interpretation-box {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid ${template.styling.primaryColor};
      margin-top: 20px;
    }
    .interpretation-title {
      font-weight: bold;
      color: ${template.styling.primaryColor};
      margin-bottom: 10px;
    }
    @media print {
      body { margin: 0; padding: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${template.header.labName}</div>
    <div>${template.header.address}</div>
    <div>Phone: ${template.header.phone} | Email: ${template.header.email}</div>
    <hr style="border: 1px solid ${template.styling.primaryColor}; margin: 10px 0;"/>
  </div>

  <h1>LIMS Lab Report</h1>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-title">Patient Info:</div>
      <div class="info-item"><span class="info-label">Name:</span> ${patient.name}</div>
      <div class="info-item"><span class="info-label">ID:</span> ${patient.id}</div>
      <div class="info-item"><span class="info-label">Age/Gender:</span> ${patient.age} Years / ${patient.gender}</div>
      <div class="info-item"><span class="info-label">Referred By:</span> ${patient.referredBy}</div>
    </div>
    
    <div class="info-box">
      <div class="info-title">Report Details:</div>
      <div class="info-item"><span class="info-label">Report ID:</span> ${report.reportId}</div>
      <div class="info-item"><span class="info-label">Collection:</span> ${new Date(report.collectionDate).toLocaleDateString()}</div>
      <div class="info-item"><span class="info-label">Report Date:</span> ${new Date(report.reportDate).toLocaleDateString()}</div>
      <div class="info-item"><span class="info-label">Test Group:</span> ${report.reportType}</div>
    </div>
  </div>

  <div class="section">
    <h2>Test Results:</h2>
    <table>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Result</th>
          <th>Unit</th>
          <th>Reference Range</th>
          <th>Flag</th>
        </tr>
      </thead>
      <tbody>
        ${testResults.map(result => `
          <tr>
            <td>${result.parameter}</td>
            <td class="result-value ${result.flag ? `flag-${result.flag.toLowerCase()}` : ''}">${result.result}</td>
            <td>${result.unit}</td>
            <td>${result.referenceRange}</td>
            <td>${result.flag ? `<span class="flag-${result.flag.toLowerCase()}">${result.flag}</span>` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="interpretation-box">
    <div class="interpretation-title">Interpretation:</div>
    <div>${interpretation}</div>
  </div>

  <div class="footer">
    <hr style="border: 1px solid ${template.styling.secondaryColor}; margin: 15px 0;"/>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>Generated on: ${new Date().toLocaleString()}</div>
      <div>
        Authorized by: ${template.footer.authorizedBy}<br>
        ${template.footer.signature}
      </div>
    </div>
    ${template.footer.disclaimer ? `<div style="margin-top: 10px; font-style: italic; font-size: 10px;">${template.footer.disclaimer}</div>` : ''}
  </div>
</body>
</html>`;
};

// Generate PDF using PDF.co API with HTML template
export const generatePDF = async (reportData: ReportData): Promise<string> => {
  const apiKey = 'landinquiryfirm@gmail.com_AEu7lrDUacQsWOHuJ757dQDYPrJz6XbsYQcX2HrSVXf1LX8cvBn94TPzmfpeVgrT';
  const apiUrl = 'https://api.pdf.co/v1/pdf/convert/from/html';

  // Generate HTML content using the universal template
  const htmlContent = generateUniversalHTMLTemplate(reportData);

  const requestBody = {
    name: `${reportData.patient.name.replace(/\s+/g, '_')}_${reportData.report.reportId}.pdf`,
    html: htmlContent,
    async: false,
    margins: "10mm",
    paperSize: "A4",
    orientation: "portrait",
    printBackground: true,
    scale: 1.0,
    mediaType: "print"
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`PDF.co API error: ${result.message}`);
    }

    return result.url; // Return the PDF download URL
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Download PDF from URL
export const downloadPDF = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

// Generate and download report PDF
export const generateAndDownloadReport = async (reportData: ReportData): Promise<void> => {
  try {
    const pdfUrl = await generatePDF(reportData);
    const filename = `${reportData.patient.name.replace(/\s+/g, '_')}_${reportData.report.reportId}.pdf`;
    await downloadPDF(pdfUrl, filename);
  } catch (error) {
    console.error('Error generating and downloading report:', error);
    throw error;
  }
};

// Generate sample report data for testing
export const generateSampleReportData = (template: LabTemplate = defaultLabTemplate): ReportData => {
  return {
    patient: {
      name: 'Ravi Mehta',
      id: 'PTX100256',
      age: 45,
      gender: 'Male',
      referredBy: 'Dr. Anjali Desai',
    },
    report: {
      reportId: 'RPT20250629',
      collectionDate: '2025-06-28',
      reportDate: '2025-06-29',
      reportType: 'Liver Function Test (LFT)',
    },
    testResults: [
      { parameter: 'SGOT (AST)', result: '72', unit: 'U/L', referenceRange: '15–37', flag: 'H' },
      { parameter: 'SGPT (ALT)', result: '105', unit: 'U/L', referenceRange: '16–63', flag: 'H' },
      { parameter: 'Total Bilirubin', result: '1.9', unit: 'mg/dL', referenceRange: '0.2–1', flag: 'H' },
      { parameter: 'Albumin', result: '2.8', unit: 'g/dL', referenceRange: '3.4–5', flag: 'L' },
    ],
    interpretation: 'Liver enzymes are elevated, and total bilirubin is above the normal limit. Suggestive of hepatic stress. Clinical correlation advised.',
    template,
  };
};