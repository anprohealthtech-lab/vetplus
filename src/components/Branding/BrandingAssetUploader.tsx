import React, { useState } from 'react';

interface BrandingAssetUploaderProps {
  assetType: 'header' | 'footer' | 'watermark' | 'logo' | 'letterhead';
  labId: string;
  apiBaseUrl?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64] = result.split(',');
      resolve(base64 || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const BrandingAssetUploader: React.FC<BrandingAssetUploaderProps> = ({
  assetType,
  labId,
  apiBaseUrl = '',
  onSuccess,
  onClose,
}) => {
  const [assetName, setAssetName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!assetName) {
      setError('Asset name is required');
      return;
    }

    if (!file) {
      setError('Please choose a file to upload');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const base64Data = await toBase64(file);
      if (!base64Data) {
        throw new Error('Could not read file contents');
      }

      const response = await fetch(`${apiBaseUrl}/.netlify/functions/branding-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labId,
          assetType,
          fileName: file.name,
          contentType: file.type,
          base64Data,
          assetName,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Upload failed');
      }

      onSuccess();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload {assetType}</h2>
            <p className="text-sm text-gray-500">This is a temporary placeholder until the upload workflow is connected.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Asset name</label>
            <input
              type="text"
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
              placeholder="e.g. Primary Lab Logo"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">File</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-sm"
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Uploading…' : 'Upload asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
