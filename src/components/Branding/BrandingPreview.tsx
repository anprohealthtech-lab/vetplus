import React from 'react';
import { FileText, Image, PenTool } from 'lucide-react';

import type { BrandingAssetSummary } from './BrandingAssetCard';
import type { SignatureSummary } from './SignatureCard';

interface BrandingPreviewProps {
  brandingAssets: BrandingAssetSummary[];
  userSignatures: SignatureSummary[];
}

export const BrandingPreview: React.FC<BrandingPreviewProps> = ({ brandingAssets, userSignatures }) => {
  const defaultLogo = brandingAssets.find((asset) => asset.asset_type === 'logo' && asset.is_default);
  const defaultHeader = brandingAssets.find((asset) => asset.asset_type === 'header' && asset.is_default);
  const defaultFooter = brandingAssets.find((asset) => asset.asset_type === 'footer' && asset.is_default);
  const defaultSignature = userSignatures.find((signature) => signature.is_default);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-gray-700">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Report preview</h2>
        </div>
        <p className="text-sm text-gray-600">
          This lightweight preview helps confirm that default assets are configured. Replace it once the PDF preview
          experience is connected to the real report templates.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-gray-700">
            <Image className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Logo</h3>
          </div>
          {defaultLogo ? (
            <img src={defaultLogo.file_url} alt={defaultLogo.asset_name} className="mx-auto h-24 object-contain" />
          ) : (
            <p className="text-sm text-gray-500">No default logo selected.</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-gray-700">
            <Image className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Header</h3>
          </div>
          {defaultHeader ? (
            <img src={defaultHeader.file_url} alt={defaultHeader.asset_name} className="mx-auto h-24 object-contain" />
          ) : (
            <p className="text-sm text-gray-500">No default header selected.</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-gray-700">
            <Image className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Footer</h3>
          </div>
          {defaultFooter ? (
            <img src={defaultFooter.file_url} alt={defaultFooter.asset_name} className="mx-auto h-24 object-contain" />
          ) : (
            <p className="text-sm text-gray-500">No default footer selected.</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-gray-700">
            <PenTool className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Default signature</h3>
          </div>
          {defaultSignature ? (
            defaultSignature.file_url ? (
              <img src={defaultSignature.file_url} alt={defaultSignature.signature_name} className="mx-auto h-24 object-contain" />
            ) : (
              <p className="text-sm text-gray-600">{defaultSignature.text_signature || 'Text signature configured.'}</p>
            )
          ) : (
            <p className="text-sm text-gray-500">No default signature selected.</p>
          )}
        </div>
      </div>
    </div>
  );
};
