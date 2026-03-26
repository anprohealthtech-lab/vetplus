// components/Samples/SampleLabelPrinter.tsx
// Generate and print sample labels with barcode and QR code

import React, { useEffect, useState } from 'react';
import { Printer, Download, Loader } from 'lucide-react';
import { Sample } from '../../services/sampleService';
import { generateBarcodeSync } from '../../utils/barcodeGenerator';
import { generateSampleQRCode } from '../../utils/qrCodeGenerator';
import JsBarcode from 'jsbarcode';

interface SampleLabelPrinterProps {
  sample: Sample;
  patientName?: string;
  showDownload?: boolean;
}

export const SampleLabelPrinter: React.FC<SampleLabelPrinterProps> = ({
  sample,
  patientName,
  showDownload = false
}) => {
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateCodes();
  }, [sample]);

  const generateCodes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate barcode
      // Generate barcode using the numeric barcode if available
      const barcodeValue = sample.barcode || sample.id;
      const barcode = generateBarcodeSync(JsBarcode, barcodeValue, {
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 5
      });
      setBarcodeDataUrl(barcode);

      // Generate QR code
      if (sample.qr_code_data) {
        const qr = await generateSampleQRCode(sample.qr_code_data, {
          width: 120,
          margin: 1
        });
        setQrCodeDataUrl(qr);
      }
    } catch (err) {
      console.error('Error generating codes:', err);
      setError('Failed to generate barcode/QR code');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=300');

    if (!printWindow) {
      alert('Please allow popups for this website');
      return;
    }

    const labelHTML = `
      <html>
        <head>
          <title>Sample Label - ${sample.id}</title>
          <style>
            @page { 
              size: 3in 2in; 
              margin: 0; 
            }
            body { 
              font-family: 'Courier New', monospace; 
              text-align: center; 
              padding: 10px;
              margin: 0;
            }
            .sample-id { 
              font-size: 13px; 
              font-weight: bold; 
              margin-bottom: 4px;
              letter-spacing: 0.5px;
            }
            .barcode { 
              margin: 6px 0; 
            }
            .barcode img {
              max-width: 95%;
              height: auto;
            }
            .qr-section {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              margin: 6px 0;
            }
            .qr {
              flex-shrink: 0;
            }
            .metadata { 
              font-size: 10px; 
              color: #000; 
              line-height: 1.4;
              text-align: center;
              margin-top: 5px;
            }
            .metadata-row {
              margin: 2px 0;
            }
            .timestamp {
              font-size: 8px;
              color: #666;
              margin-top: 6px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="sample-id">${sample.id}</div>
          <div class="barcode">
            <img src="${barcodeDataUrl}" alt="Barcode" />
          </div>
          
          <!-- QR Code removed from print as requested -->
          
          <div class="metadata">
            <div class="metadata-row"><strong>Type:</strong> ${sample.sample_type}</div>
            <div class="metadata-row"><strong>Container:</strong> ${sample.container_type}</div>
            ${patientName ? `<div class="metadata-row"><strong>Patient:</strong> ${patientName}</div>` : ''}
          </div>
          
          <div class="timestamp">Created: ${new Date(sample.created_at).toLocaleString()}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(labelHTML);
    printWindow.document.close();
  };

  const handleDownload = () => {
    // Create a canvas to combine barcode and QR code
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sample ID
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sample.id, canvas.width / 2, 20);

    // Load and draw barcode
    if (barcodeDataUrl) {
      const barcodeImg = new Image();
      barcodeImg.onload = () => {
        ctx.drawImage(barcodeImg, 10, 30, 280, 60);

        // Load and draw QR code
        if (qrCodeDataUrl) {
          const qrImg = new Image();
          qrImg.onload = () => {
            ctx.drawImage(qrImg, 200, 100, 80, 80);

            // Sample info
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Type: ${sample.sample_type}`, 10, 110);
            ctx.fillText(`Container: ${sample.container_type}`, 10, 125);

            // Download
            const link = document.createElement('a');
            link.download = `sample-label-${sample.id}.png`;
            link.href = canvas.toDataURL();
            link.click();
          };
          qrImg.src = qrCodeDataUrl;
        } else {
          // Download without QR
          const link = document.createElement('a');
          link.download = `sample-label-${sample.id}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
      };
      barcodeImg.src = barcodeDataUrl;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
        <Loader className="h-4 w-4 text-gray-600 animate-spin" />
        <span className="text-sm text-gray-600">Generating label...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="text-center">
          <div className="font-mono font-bold text-sm mb-2">{sample.id}</div>
          {barcodeDataUrl && (
            <div className="mb-2">
              <img src={barcodeDataUrl} alt="Barcode" className="mx-auto" style={{ maxWidth: '250px' }} />
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            {qrCodeDataUrl && (
              <img src={qrCodeDataUrl} alt="QR Code" width="80" height="80" />
            )}
            <div className="text-left text-xs text-gray-600">
              <div className="mb-1"><strong>Type:</strong> {sample.sample_type}</div>
              <div className="mb-1"><strong>Container:</strong> {sample.container_type}</div>
              {patientName && <div><strong>Patient:</strong> {patientName}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
        {showDownload && (
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        )}
      </div>
    </div>
  );
};

export default SampleLabelPrinter;
