import React, { useState, useEffect } from 'react';
import {
  Upload,
  Image,
  FileText,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { auth, database } from '../utils/supabase';
import { useBrandingProcessingStatus } from '../hooks/useBrandingProcessingStatus';
import { BrandingAssetUploader } from '../components/Branding/BrandingAssetUploader';
import { SignatureUploader } from '../components/Branding/SignatureUploader';
import { BrandingAssetCard } from '../components/Branding/BrandingAssetCard';
import { SignatureCard } from '../components/Branding/SignatureCard';
import { BrandingPreview } from '../components/Branding/BrandingPreview';

interface BrandingAsset {
  id: string;
  asset_type: 'header' | 'footer' | 'watermark' | 'logo' | 'letterhead';
  asset_name: string;
  file_url: string;
  file_type: string;
  is_active: boolean;
  is_default: boolean;
  processing_status?: 'pending' | 'processing' | 'ready' | 'error';
  created_at: string;
  variants?: AssetVariant[] | Record<string, string> | null;
}

interface UserSignature {
  id: string;
  signature_type: 'digital' | 'handwritten' | 'stamp' | 'text';
  signature_name: string;
  file_url?: string;
  text_signature?: string;
  is_active: boolean;
  is_default: boolean;
  processing_status?: 'pending' | 'processing' | 'ready' | 'error';
  created_at: string;
  variants?: SignatureVariant[] | Record<string, string> | null;
}

interface AssetVariant {
  id: string;
  variant_type: 'original' | '1x' | '2x' | '3x' | 'thumbnail' | 'optimized';
  format: 'png' | 'webp' | 'jpg';
  file_url: string;
  width: number;
  height: number;
  file_size: number;
  imagekit_url?: string;
}

interface SignatureVariant {
  id: string;
  variant_type: 'original' | '1x' | '2x' | '3x' | 'thumbnail' | 'optimized';
  format: 'png' | 'webp' | 'jpg';
  file_url: string;
  width: number;
  height: number;
  file_size: number;
  imagekit_url?: string;
}

const isPlaceholderId = (value: string) => value.startsWith('temp-');

export const BrandingSettings: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'assets' | 'signatures' | 'preview'>('assets');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [brandingAssets, setBrandingAssets] = useState<BrandingAsset[]>([]);
  const [userSignatures, setUserSignatures] = useState<UserSignature[]>([]);
  const [labId, setLabId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Upload states
  const [showAssetUploader, setShowAssetUploader] = useState(false);
  const [showSignatureUploader, setShowSignatureUploader] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<'header' | 'footer' | 'watermark' | 'logo' | 'letterhead'>('logo');
  
  // Processing status polling
  const { processingItems, isPolling } = useBrandingProcessingStatus(labId);

  // Load initial data
  useEffect(() => {
    loadBrandingData();
  }, []);

  const loadBrandingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current lab ID
      const currentLabId = await database.getCurrentUserLabId();
      if (!currentLabId) {
        throw new Error('No lab ID found for current user');
      }
  setLabId(currentLabId);

  const { user } = await auth.getCurrentUser();
  setCurrentUserId(user?.id || null);

      // Load branding assets
      const { data: assets, error: assetsError } = await database.labBrandingAssets.getAll(currentLabId);
      if (assetsError) {
        throw new Error(`Failed to load branding assets: ${assetsError.message}`);
      }

      // Load user signatures
      const { data: signatures, error: signaturesError } = await database.userSignatures.getAll();
      if (signaturesError) {
        throw new Error(`Failed to load signatures: ${signaturesError.message}`);
      }

      setBrandingAssets(assets || []);
      setUserSignatures(signatures || []);
    } catch (err) {
      console.error('Error loading branding data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load branding data');
    } finally {
      setLoading(false);
    }
  };

  // Handle upload completion
  const handleAssetUploaded = async () => {
    await loadBrandingData();
    setShowAssetUploader(false);
  };

  const handleSignatureUploaded = async () => {
    await loadBrandingData();
    setShowSignatureUploader(false);
  };

  // Handle setting as default
  const handleSetAssetDefault = async (assetId: string) => {
    if (isPlaceholderId(assetId)) {
      return;
    }

    try {
      const { error } = await database.labBrandingAssets.setDefault(assetId);
      if (error) {
        throw new Error(error.message);
      }
      
      // Refresh data to show updated defaults
      await loadBrandingData();
    } catch (err) {
      console.error('Error setting asset as default:', err);
      // Show error toast
    }
  };

  const handleSetSignatureDefault = async (signatureId: string) => {
    if (isPlaceholderId(signatureId)) {
      return;
    }

    try {
      const { error } = await database.userSignatures.setDefault(signatureId);
      if (error) {
        throw new Error(error.message);
      }
      
      // Refresh data to show updated defaults
      await loadBrandingData();
    } catch (err) {
      console.error('Error setting signature as default:', err);
      // Show error toast
    }
  };

  // Handle delete
  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this branding asset?')) {
      return;
    }

    if (isPlaceholderId(assetId)) {
      setBrandingAssets(prev => prev.filter(asset => asset.id !== assetId));
      return;
    }

    try {
      const { error } = await database.labBrandingAssets.delete(assetId);
      if (error) {
        throw new Error(error.message);
      }
      
      setBrandingAssets(prev => prev.filter(asset => asset.id !== assetId));
    } catch (err) {
      console.error('Error deleting asset:', err);
      // Show error toast
    }
  };

  const handleDeleteSignature = async (signatureId: string) => {
    if (!confirm('Are you sure you want to delete this signature?')) {
      return;
    }

    if (isPlaceholderId(signatureId)) {
      setUserSignatures(prev => prev.filter(signature => signature.id !== signatureId));
      return;
    }

    try {
      const { error } = await database.userSignatures.delete(signatureId);
      if (error) {
        throw new Error(error.message);
      }
      
      setUserSignatures(prev => prev.filter(signature => signature.id !== signatureId));
    } catch (err) {
      console.error('Error deleting signature:', err);
      // Show error toast
    }
  };

  const getProcessingStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'logo':
        return <Image className="w-5 h-5" />;
      case 'header':
      case 'footer':
        return <FileText className="w-5 h-5" />;
      case 'watermark':
        return <Eye className="w-5 h-5" />;
      case 'letterhead':
        return <FileText className="w-5 h-5" />;
      default:
        return <Image className="w-5 h-5" />;
    }
  };

  const groupAssetsByType = (assets: BrandingAsset[]) => {
    return assets.reduce((groups, asset) => {
      if (!groups[asset.asset_type]) {
        groups[asset.asset_type] = [];
      }
      groups[asset.asset_type].push(asset);
      return groups;
    }, {} as Record<string, BrandingAsset[]>);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading branding settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center mb-2">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
          <h3 className="font-semibold text-red-800">Error Loading Branding Settings</h3>
        </div>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={loadBrandingData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const groupedAssets = groupAssetsByType(brandingAssets);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branding Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your lab's branding assets and digital signatures
          </p>
        </div>
        <div className="flex gap-2">
          {isPolling && (
            <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing {processingItems.length} item(s)
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'assets', label: 'Branding Assets', icon: Image },
            { id: 'signatures', label: 'Digital Signatures', icon: FileText },
            { id: 'preview', label: 'Preview & Export', icon: Eye }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm ${
                  currentTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {currentTab === 'assets' && (
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Upload New Branding Asset</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload logos, headers, footers, watermarks, or letterheads
              </p>
              <div className="mt-6 flex gap-2 justify-center flex-wrap">
                {(['logo', 'header', 'footer', 'watermark', 'letterhead'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedAssetType(type);
                      setShowAssetUploader(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    {getAssetTypeIcon(type)}
                    <span className="ml-2 capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assets by Type */}
          {Object.entries(groupedAssets).map(([type, assets]) => (
            <div key={type} className="space-y-4">
              <div className="flex items-center">
                {getAssetTypeIcon(type)}
                <h3 className="ml-2 text-lg font-medium text-gray-900 capitalize">{type}s</h3>
                <span className="ml-2 text-sm text-gray-500">({assets.length})</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <BrandingAssetCard
                    key={asset.id}
                    asset={asset}
                    onSetDefault={() => handleSetAssetDefault(asset.id)}
                    onDelete={() => handleDeleteAsset(asset.id)}
                    processingStatus={processingItems.find(item => 
                      item.asset_id === asset.id && item.asset_type === 'branding_asset'
                    )?.status}
                  />
                ))}
              </div>
            </div>
          ))}

          {brandingAssets.length === 0 && (
            <div className="text-center py-12">
              <Image className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No branding assets</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by uploading your first asset.</p>
            </div>
          )}
        </div>
      )}

      {currentTab === 'signatures' && (
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Add Digital Signature</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload signature images or create text-based signatures
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowSignatureUploader(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Signature
                </button>
              </div>
            </div>
          </div>

          {/* Signatures Grid */}
          {userSignatures.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userSignatures.map((signature) => (
                <SignatureCard
                  key={signature.id}
                  signature={signature}
                  onSetDefault={() => handleSetSignatureDefault(signature.id)}
                  onDelete={() => handleDeleteSignature(signature.id)}
                  processingStatus={processingItems.find(item => 
                    item.asset_id === signature.id && item.asset_type === 'user_signature'
                  )?.status}
                />
              ))}
            </div>
          )}

          {userSignatures.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No signatures</h3>
              <p className="mt-1 text-sm text-gray-500">Add your first digital signature to get started.</p>
            </div>
          )}
        </div>
      )}

      {currentTab === 'preview' && (
        <BrandingPreview 
          brandingAssets={brandingAssets}
          userSignatures={userSignatures}
        />
      )}

      {/* Upload Modals */}
      {showAssetUploader && labId && (
        <BrandingAssetUploader
          assetType={selectedAssetType}
          labId={labId}
          onSuccess={handleAssetUploaded}
          onClose={() => setShowAssetUploader(false)}
        />
      )}

      {showSignatureUploader && labId && currentUserId && (
        <SignatureUploader
          labId={labId}
          userId={currentUserId}
          onSuccess={handleSignatureUploaded}
          onClose={() => setShowSignatureUploader(false)}
        />
      )}
    </div>
  );
};