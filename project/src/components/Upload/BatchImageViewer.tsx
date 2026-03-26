import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Eye, 
  Trash2, 
  Edit3, 
  Calendar, 
  User, 
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Tag,
  Grid3X3,
  List,
  Maximize2,
  Info
} from 'lucide-react';
import { supabase, database } from '../../utils/supabase';

interface BatchAttachment {
  id: string;
  batch_id: string;
  batch_sequence: number;
  batch_total: number;
  image_label: string;
  file_url: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  upload_timestamp: string;
  uploaded_by?: string;
  description?: string;
  batch_metadata?: any;
}

interface BatchInfo {
  id: string;
  order_id: string;
  upload_type: string;
  total_files: number;
  upload_context: any;
  uploaded_by: string;
  created_at: string;
  batch_description?: string;
  uploaded_by_email?: string;
}

interface BatchImageViewerProps {
  batchId: string;
  onClose: () => void;
  onRemove?: (imageId: string) => void;
  onUpdateLabel?: (imageId: string, customLabel: string) => void;
  onBatchDeleted?: (batchId: string) => void;
  initialAttachments?: BatchAttachment[];
  enableAIReference?: boolean;
  readonly?: boolean;
}

const BatchImageViewer: React.FC<BatchImageViewerProps> = ({
  batchId,
  onClose,
  onRemove,
  onUpdateLabel,
  onBatchDeleted,
  enableAIReference = true,
  readonly = false
}) => {
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [images, setImages] = useState<BatchAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<BatchAttachment | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ id: string; label: string } | null>(null);
  const [viewMode, setViewMode] = useState<'detailed' | 'grid' | 'list'>('detailed');
  const [showImageInfo, setShowImageInfo] = useState(true);

  // Load batch data
  useEffect(() => {
    loadBatchData();
  }, [batchId]);

  const loadBatchData = async () => {
    try {
      setLoading(true);

      // Get batch info
      const { data: batchData, error: batchError } = await supabase
        .from('attachment_batches')
        .select('*, users:uploaded_by(email)')
        .eq('id', batchId)
        .single();

      if (batchError) throw batchError;

      setBatch({
        ...batchData,
        uploaded_by_email: batchData.users?.email
      });

      // Get attachments for this batch
      const { data: attachments, error: attachError } = await supabase
        .from('attachments')
        .select('*')
        .eq('batch_id', batchId)
        .order('batch_sequence');

      if (attachError) {
        console.error('Error fetching attachments for batch:', attachError);
      }

      const finalAttachments = (attachments && attachments.length > 0)
        ? attachments
        : (initialAttachments || []);

      setImages(finalAttachments || []);
      if (finalAttachments && finalAttachments.length) setSelectedImage(finalAttachments[0]);

    } catch (error) {
      console.error('Error loading batch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle label update
  const handleUpdateLabel = async (imageId: string, newLabel: string) => {
    try {
      const { error } = await supabase
        .from('attachments')
        .update({ image_label: newLabel })
        .eq('id', imageId);

      if (error) throw error;

      // Update local state
      setImages(prev => 
        prev.map(img => 
          img.id === imageId ? { ...img, image_label: newLabel } : img
        )
      );

      if (selectedImage?.id === imageId) {
        setSelectedImage(prev => prev ? { ...prev, image_label: newLabel } : null);
      }

      setEditingLabel(null);

      // Call parent callback
      onUpdateLabel?.(imageId, newLabel);

    } catch (error) {
      console.error('Error updating label:', error);
      alert('Failed to update label');
    }
  };

  // Download image
  const handleDownload = async (image: BatchAttachment) => {
    try {
      const response = await fetch(image.file_url);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image');
    }
  };

  // Delete all images in the batch
  const handleDeleteAllImages = async () => {
    if (!batchId || images.length === 0) return;
    
    const confirmMessage = `Are you sure you want to delete all ${images.length} images in this batch? This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      try {
        // Delete files from storage first
        const filePaths = images
          .map(img => img.file_url.split('/').pop())
          .filter(Boolean)
          .map(fileName => `${images[0]?.batch_id}/${fileName}`);
        
        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('attachments')
            .remove(filePaths);
          
          if (storageError) {
            console.warn('Some files failed to delete from storage:', storageError);
          }
        }
        
        // Delete attachments from database
        const { error: attachmentsError } = await supabase
          .from('attachments')
          .delete()
          .eq('batch_id', batchId);
        
        if (attachmentsError) throw attachmentsError;
        
        // Delete batch record
        const { error: batchError } = await supabase
          .from('attachment_batches')
          .delete()
          .eq('id', batchId);
        
        if (batchError) throw batchError;
        
        // Clear local state
        setImages([]);
        setSelectedImage(null);
        
        // Notify parent component
        onBatchDeleted?.(batchId);
        
        // Close the viewer since all images are deleted
        alert('All images deleted successfully');
        onClose();
        
      } catch (error) {
        console.error('Error deleting all images:', error);
        alert('Failed to delete images. Please try again.');
      }
    }
  };

  // Download all images as a zip file
  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    
    try {
      // For now, trigger individual downloads
      // TODO: Implement proper zip download functionality
      const downloadPromises = images.map(async (image, index) => {
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await handleDownload(image);
              resolve();
            } catch (error) {
              console.error(`Failed to download ${image.original_filename}:`, error);
              resolve();
            }
          }, index * 500); // Stagger downloads by 500ms
        });
      });
      
      await Promise.all(downloadPromises);
      
    } catch (error) {
      console.error('Error downloading all images:', error);
      alert('Some downloads may have failed. Please check your downloads folder.');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-pulse">Loading batch...</div>
        </div>
      </div>
    );
  }

  if (!batch || images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>No images found in this batch.</p>
          <button 
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl max-h-[90vh] w-full flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Image Batch Viewer</h2>
            <p className="text-sm text-gray-600">
              {batch.total_files} images • Uploaded {formatDate(batch.created_at)}
            </p>
          </div>
          
          {/* View Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('detailed')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'detailed' 
                    ? 'bg-white text-blue-600 shadow' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
                title="Detailed View"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-white text-blue-600 shadow' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
                title="Grid View"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-blue-600 shadow' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={() => setShowImageInfo(!showImageInfo)}
              className={`p-2 rounded transition-colors ${
                showImageInfo 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-400 hover:text-blue-600'
              }`}
              title="Toggle Image Information"
            >
              <Info className="h-4 w-4" />
            </button>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Render different view modes */}
        {viewMode === 'detailed' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Image List Sidebar */}
            <div className="w-80 border-r bg-gray-50 overflow-y-auto">
            <div className="p-4">
              {/* Batch Actions Header */}
              <div className="mb-4 p-3 bg-white rounded-lg border">
                <h3 className="font-medium mb-3 flex items-center justify-between">
                  <span>
                    Images ({images.length})
                    {enableAIReference && (
                      <span className="text-sm text-blue-600 ml-2">AI Ready</span>
                    )}
                  </span>
                </h3>
                
                {!readonly && images.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAllImages}
                      className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-sm"
                      title="Delete all images in this batch"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete All
                    </button>
                    <button
                      onClick={handleDownloadAll}
                      className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 text-sm"
                      title="Download all images as zip"
                    >
                      <Download className="h-4 w-4" />
                      Download All
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {images.map((image) => (
                  <div
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedImage?.id === image.id 
                        ? 'bg-blue-100 border-blue-300 border-2' 
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      
                      {/* Thumbnail */}
                      <div className="w-12 h-12 flex-shrink-0">
                        {image.file_type.startsWith('image/') ? (
                          <img
                            src={image.file_url}
                            alt={image.image_label}
                            className="w-full h-full object-cover rounded border"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded border flex items-center justify-center">
                            <FileText className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {enableAIReference && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {image.image_label}
                            </span>
                          )}
                          {editingLabel?.id === image.id ? (
                            <input
                              type="text"
                              value={editingLabel.label}
                              onChange={(e) => setEditingLabel({ id: image.id, label: e.target.value })}
                              onBlur={() => handleUpdateLabel(image.id, editingLabel.label)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateLabel(image.id, editingLabel.label);
                                } else if (e.key === 'Escape') {
                                  setEditingLabel(null);
                                }
                              }}
                              className="text-xs border border-blue-300 rounded px-1 py-0.5"
                              autoFocus
                            />
                          ) : (
                            !readonly && onUpdateLabel && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLabel({ id: image.id, label: image.image_label });
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Edit label"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            )
                          )}
                        </div>
                        
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {image.original_filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(image.file_size)}
                        </p>

                        {/* Actions */}
                        {!readonly && (
                          <div className="flex items-center gap-1 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(image);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                            
                            {onRemove && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemove(image.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Remove"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Image Display */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedImage ? (
              <div className="space-y-4">
                
                {/* Image Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {enableAIReference && (
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-blue-600" />
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 font-medium rounded-lg">
                          {selectedImage.image_label}
                        </span>
                        <span className="text-sm text-gray-500">
                          (Reference for AI analysis)
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(selectedImage)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                    
                    <a
                      href={selectedImage.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Full Size
                    </a>
                  </div>
                </div>

                {/* Image Display */}
                <div className="bg-gray-100 rounded-lg p-4">
                  {selectedImage.file_type.startsWith('image/') ? (
                    <img
                      src={selectedImage.file_url}
                      alt={selectedImage.image_label}
                      className="max-w-full max-h-96 mx-auto rounded shadow-lg"
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        This file type cannot be previewed. 
                        <a 
                          href={selectedImage.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline ml-1"
                        >
                          Open in new tab
                        </a>
                      </p>
                    </div>
                  )}
                </div>

                {/* Image Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Image Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Filename:</span>
                      <p className="font-medium">{selectedImage.original_filename}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Size:</span>
                      <p className="font-medium">{formatFileSize(selectedImage.file_size)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <p className="font-medium">{selectedImage.file_type}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Sequence:</span>
                      <p className="font-medium">
                        {selectedImage.batch_sequence} of {selectedImage.batch_total}
                      </p>
                    </div>
                    {selectedImage.batch_metadata?.dimensions && (
                      <div>
                        <span className="text-gray-600">Dimensions:</span>
                        <p className="font-medium">
                          {selectedImage.batch_metadata.dimensions.width} × {selectedImage.batch_metadata.dimensions.height}px
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Uploaded:</span>
                      <p className="font-medium">{formatDate(selectedImage.upload_timestamp)}</p>
                    </div>
                  </div>

                  {selectedImage.description && (
                    <div className="mt-4">
                      <span className="text-gray-600">Description:</span>
                      <p className="font-medium">{selectedImage.description}</p>
                    </div>
                  )}
                </div>

                {/* Batch Context */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3 text-blue-900">Batch Information</h4>
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2 text-blue-800">
                      <User className="h-4 w-4" />
                      <span>Uploaded by: {batch.uploaded_by_email || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-800">
                      <Calendar className="h-4 w-4" />
                      <span>Batch created: {formatDate(batch.created_at)}</span>
                    </div>
                    {batch.batch_description && (
                      <p className="text-blue-700 mt-2">{batch.batch_description}</p>
                    )}
                    {enableAIReference && (
                      <div className="mt-3 p-3 bg-blue-100 rounded border-blue-200 border">
                        <p className="text-blue-900 font-medium text-xs mb-1">
                          🤖 AI Analysis Reference
                        </p>
                        <p className="text-blue-700 text-xs">
                          Use "{selectedImage.image_label}" in AI prompts to reference this specific image.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Select an image to view</p>
                </div>
              </div>
            )}
          </div>
        </div>

        ) : viewMode === 'grid' ? (
          // Grid View
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative group bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  {/* Image */}
                  <div className="aspect-square">
                    {image.file_type.startsWith('image/') ? (
                      <img
                        src={image.file_url}
                        alt={image.image_label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(image);
                          }}
                          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        {!readonly && onRemove && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(image.id);
                            }}
                            className="p-1.5 bg-white rounded shadow hover:bg-red-50 text-red-600"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Image Info */}
                  {showImageInfo && (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-blue-600">
                          {image.image_label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {image.batch_sequence}/{image.batch_total}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {image.original_filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(image.file_size)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Batch Actions for Grid View */}
            {!readonly && images.length > 0 && (
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={handleDeleteAllImages}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All Images
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download All Images
                </button>
              </div>
            )}
          </div>

        ) : (
          // List View
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0">
                    {image.file_type.startsWith('image/') ? (
                      <img
                        src={image.file_url}
                        alt={image.image_label}
                        className="w-full h-full object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded border flex items-center justify-center">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-blue-600">
                        {image.image_label}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({image.batch_sequence}/{image.batch_total})
                      </span>
                      {enableAIReference && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          AI Ready
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 truncate">{image.original_filename}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{formatFileSize(image.file_size)}</span>
                      <span>{formatDate(image.upload_timestamp)}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  {!readonly && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(image.file_url, '_blank');
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="View Full Size"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      {onRemove && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(image.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Batch Actions for List View */}
            {!readonly && images.length > 0 && (
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={handleDeleteAllImages}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All Images
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download All Images
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default BatchImageViewer;