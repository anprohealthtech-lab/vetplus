// Direct PDF.co API Test Script
// Usage: node test-pdfco-direct.js

const PDFCO_API_KEY = 'landinquiryfirm@gmail.com_AEu7lrDUacQsWOHuJ757dQDYPrJz6XbsYQcX2HrSVXf1LX8cvBn94TPzmfpeVgrT';
const PDFCO_API_URL = 'https://api.pdf.co/v1/pdf/convert/from/html';

// Report Letterhead Background Image (Full Page)
const BACKGROUND_IMAGE_URL = 'https://ik.imagekit.io/18tsendxqy/WhatsApp%20Image%202026-01-07%20at%2012.38.55.jpeg';

async function buildBodyHtml() {
  const bgImage = BACKGROUND_IMAGE_URL;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Zero Margins for @page ensures Background is Full Bleed (starts at 0,0) */
    @page { margin: 0; }
    
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }

    /* Fixed Background Layer for Full Bleed Letterhead */
    /* Position fixed at 0,0 covers the page. */
    #page-background {
        position: fixed;
        top: 0;
        left: 0;
        width: 210mm; 
        height: 297mm;
        z-index: -100;
        background-image: url('${bgImage}');
        background-size: 100% 100%;
        background-repeat: no-repeat;
    }

    /* Layout Table to handle Content Spacing */
    table.report-layout {
        width: 100%;
        border-collapse: collapse;
        border: none;
    }
    
    /* Spacers to prevent content overlap with Header/Footer areas */
    /* Adjust height to match your letterhead design */
    .header-spacer { height: 150px; }
    .footer-spacer { height: 100px; }
    
    /* Content Cell with side padding */
    .content-cell {
        padding: 0 40px;
        vertical-align: top;
    }

    /* Styles inside the content cell */
    .content-wrapper { font-family: Arial, sans-serif; }
    .report-header { text-align: center; margin-bottom: 20px; }
    .report-header h1 { color: #2563eb; margin: 0; }
    
    .patient-info { margin: 20px 0; background: rgba(255, 255, 255, 0.85); border-radius: 4px; padding: 10px; }
    .patient-info table { width: 100%; border-collapse: collapse; }
    .patient-info td { padding: 8px; border-bottom: 1px solid #ddd; }
    .patient-info td.label { font-weight: bold; width: 20%; color: #444; }
    
    .results-table { width: 100%; border-collapse: collapse; margin-top: 20px; background: rgba(255,255,255,0.9); }
    .results-table th { background: #2563eb; color: white; padding: 10px; text-align: left; }
    .results-table td { padding: 8px; border-bottom: 1px solid #eee; }
    
    .signature-block { margin-top: 60px; text-align: right; page-break-inside: avoid; }
    .signature-block img { max-height: 50px; }

    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  
  <!-- Fixed Background on every page -->
  <div id="page-background"></div>
  
  <!-- Layout Table -->
  <table class="report-layout">
    <!-- Header Spacer - Repeats on every page -->
    <thead>
      <tr><td><div class="header-spacer">&nbsp;</div></td></tr>
    </thead>
    
    <!-- Footer Spacer - Repeats on every page -->
    <tfoot>
      <tr><td><div class="footer-spacer">&nbsp;</div></td></tr>
    </tfoot>

    <!-- Main Content -->
    <tbody>
      <tr>
        <td class="content-cell">
            <div class="content-wrapper">
                
                <div class="report-header">
                  <h1>CBC Test Report</h1>
                  <p>Laboratory Test Results</p>
                </div>

                <div class="patient-info">
                  <table>
                    <tr>
                      <td class="label">Patient Name</td> <td>John Doe</td>
                      <td class="label">Patient ID</td> <td>P-12345</td>
                    </tr>
                    <tr>
                      <td class="label">Age / Gender</td> <td>35 / Male</td>
                      <td class="label">Sample ID</td> <td>S-67890</td>
                    </tr>
                    <tr>
                      <td class="label">Ref. Doctor</td> <td>Dr. Smith</td>
                      <td class="label">Date</td> <td>10-Jan-2026</td>
                    </tr>
                  </table>
                </div>

                <table class="results-table">
                  <thead>
                    <tr>
                      <th>Test Parameter</th>
                      <th>Result</th>
                      <th>Unit</th>
                      <th>Ref. Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr> <td>Hemoglobin</td> <td><b>14.5</b></td> <td>g/dL</td> <td>13.0 - 17.0</td> </tr>
                    <tr> <td>WBC Count</td> <td>7500</td> <td>/µL</td> <td>4000 - 11000</td> </tr>
                    <tr> <td>RBC Count</td> <td>5.2</td> <td>mill/µL</td> <td>4.5 - 5.5</td> </tr>
                    <tr> <td>Platelet Count</td> <td>250000</td> <td>/µL</td> <td>150000 - 450000</td> </tr>
                    <tr> <td>Hematocrit</td> <td>42</td> <td>%</td> <td>40 - 50</td> </tr>
                    <tr> <td>MCV</td> <td>88</td> <td>fL</td> <td>80 - 100</td> </tr>
                  </tbody>
                </table>

                <div class="signature-block">
                  <img src="https://ik.imagekit.io/18tsendxqy/labs/2f8d0329-d584-4423-91f6-9ab326b700ae/lab_user_signatures/signature_P6XejzYTOZ.jpg?tr=e-removedotbg,f-webp,w-200,fo-auto" alt="Signature">
                  <p style="margin: 5px 0; font-weight: bold;">Dr. Anand</p>
                  <p style="margin: 0; color: #666;">Pathologist</p>
                </div>

                <!-- Test Multi-page Filler -->
                <div style="margin-top: 50px; color: #666;">
                   <p>... End of Page 1 Content ...</p>
                </div>
                
                <div class="page-break"></div>

                <div class="report-header">
                   <h2>Page 2 - Follow Up</h2>
                </div>
                <p>
                  This second page should now have proper spacing from the top (header) and bottom (footer) 
                  thanks to the repeating table header/footer spacers, while the background image remains full bleed.
                </p>
                <div style="text-align: justify;">
                    ${'<p>Repeated content line to fill space. '.repeat(50) + '</p>'}
                </div>

            </div>
        </td>
      </tr>
    </tbody>
  </table>

</body>
</html>
  `;
}

async function testPDFCoGeneration() {
  console.log('🧪 Testing PDF.co Background Image Letterhead\n');
  console.log('='.repeat(80));

  const TEST_BODY_HTML = await buildBodyHtml();

  const payload = {
    name: 'test-report-bg.pdf',
    html: TEST_BODY_HTML,
    paperSize: 'A4',
    orientation: 'Portrait',
    margins: '0px 0px 0px 0px', // Zero margins for full bg coverage
    printBackground: true,
    async: false
  };

  console.log('\n📦 Payload Summary:');
  console.log('  - Background Image:', BACKGROUND_IMAGE_URL);
  console.log('  - Margins:', payload.margins);
  console.log('  - PrintBackground:', payload.printBackground);

  console.log('\n📤 Sending request to PDF.co...');

  try {
    const response = await fetch(PDFCO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PDFCO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('\n❌ PDF.co API Error:', response.status);
      console.log(responseText);
      return;
    }

    const result = JSON.parse(responseText);

    if (result.error) {
      console.error('\n❌ PDF.co Error:', result.message);
      return;
    }

    console.log('\n✅ PDF Generated Successfully!');
    console.log('  📄 PDF URL:', result.url);
    console.log('\n🔗 Open to verify background image logic:\n  ', result.url);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run (needs node 18+ for fetch)
testPDFCoGeneration();
