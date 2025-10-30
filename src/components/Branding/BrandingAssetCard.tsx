import React from 'react';
import { Image, Star, Trash2 } from 'lucide-react';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'error' | undefined;

export interface BrandingAssetSummary {
  id: string;
  asset_type: 'header' | 'footer' | 'watermark' | 'logo' | 'letterhead';
  asset_name: string;
  is_default: boolean;
  is_active?: boolean;
  file_url?: string;
  created_at?: string;
}

interface BrandingAssetCardProps {
  asset: BrandingAssetSummary;
  onSetDefault: () => void;
  onDelete: () => void;
  processingStatus?: ProcessingStatus;
}

export const BrandingAssetCard: React.FC<BrandingAssetCardProps> = ({
  asset,
  onSetDefault,
  onDelete,
  processingStatus,
}) => {
  const statusLabel = processingStatus ? `Status: ${processingStatus}` : 'Status: idle';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{asset.asset_name}</p>
            <p className="text-xs text-gray-500">{asset.asset_type}</p>
          </div>
        </div>
        {asset.is_default && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
            <Star className="h-3 w-3" /> Default
          </span>
        )}
      </div>

      {asset.file_url && (
        <div className="mb-3 overflow-hidden rounded-md border border-gray-100 bg-gray-50">
          <img src={asset.file_url} alt={asset.asset_name} className="h-32 w-full object-cover" />
        </div>
      )}

      <p className="mb-3 text-xs text-gray-500">{statusLabel}</p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSetDefault}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Set as default
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    </div>
  );
};
