import { useEffect, useState } from 'react';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'error';

type ProcessingAssetType = 'branding_asset' | 'user_signature';

export interface BrandingProcessingItem {
  asset_id: string;
  asset_type: ProcessingAssetType;
  status: ProcessingStatus;
}

interface BrandingProcessingState {
  processingItems: BrandingProcessingItem[];
  isPolling: boolean;
}

const defaultState: BrandingProcessingState = {
  processingItems: [],
  isPolling: false,
};

export const useBrandingProcessingStatus = (labId: string | null): BrandingProcessingState => {
  const [processingItems, setProcessingItems] = useState<BrandingProcessingItem[]>(defaultState.processingItems);
  const [isPolling, setIsPolling] = useState<boolean>(defaultState.isPolling);

  useEffect(() => {
    // Placeholder hook keeps component wiring compile-safe until backend polling is implemented.
    setProcessingItems(defaultState.processingItems);
    setIsPolling(Boolean(labId) && defaultState.isPolling);
  }, [labId]);

  return { processingItems, isPolling };
};
