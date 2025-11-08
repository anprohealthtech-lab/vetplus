import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Trash2, 
  Edit3, 
  Calendar, 
  User, 
  FileText,
  ExternalLink,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface SingleImageViewerProps {
  imageId: string;
  onClose: () => void;
  onRemove?: (imageId: string) => void;
  onUpdateDescription?: (imageId: string, description: string) => void;
  readonly?: boolean;
}

interface ImageData {
  id: string;
  file_url: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  description?: string;
  upload_timestamp: string;
  uploaded_by?: string;
  patient_id?: string;
  order_id?: string;
}

const SingleImageViewer: React.FC<SingleImageViewerProps> = ({
  imageId,
  onClose,
  onRemove,
  onUpdateDescription,
  readonly = false
}) => {
  const [image, setImage] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    loadImageData();
  }, [imageId]);

  const loadImageData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('id', imageId)
        .single();
      
      if (error) throw error;
      
      setImage(data);
      setNewDescription(data.description || '');
      
    } catch (error) {
      console.error('Error loading image:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onRemove || !image) return;
    
    if (confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      try {
        // Delete from database
        const { error } = await supabase
          .from('attachments')
          .delete()
          .eq('id', imageId);

        if (error) throw error;

        // Call parent callback
        onRemove(imageId);
        
        // Close viewer
        onClose();

      } catch (error) {
        console.error('Error deleting image:', error);
        alert('Failed to delete image');
      }
    }
  };

  const handleDownload = async () => {
    if (!image) return;
    
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

  const handleUpdateDescription = async () => {
    if (!image) return;
    
    try {
      const { error } = await supabase
        .from('attachments')
        .update({ description: newDescription })
        .eq('id', imageId);

      if (error) throw error;

      setImage(prev => prev ? { ...prev, description: newDescription } : null);
      setEditingDescription(false);
      
      onUpdateDescription?.(imageId, newDescription);

    } catch (error) {
      console.error('Error updating description:', error);
      alert('Failed to update description');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-pulse">Loading image...</div>
        </div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Image not found</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">
      {/* Header */}
      <div className="bg-white border-b flex items-center justify-between p-4">
        <div>
          <h2 className="text-lg font-semibold truncate max-w-md">
            {image.original_filename}
          </h2>
          <p className="text-sm text-gray-600">
            {formatFileSize(image.file_size)} • {formatDate(image.upload_timestamp)}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
            className="p-2 hover:bg-gray-100 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.1))}
            className="p-2 hover:bg-gray-100 rounded"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 hover:bg-gray-100 rounded"
            title="Reset Zoom"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRotation((rotation - 90) % 360)}
            className="p-2 hover:bg-gray-100 rounded"
            title="Rotate Left"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRotation((rotation + 90) % 360)}
            className="p-2 hover:bg-gray-100 rounded"
            title="Rotate Right"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-100 rounded"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => window.open(image.file_url, '_blank')}
            className="p-2 hover:bg-gray-100 rounded"
            title="Open in New Tab"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          
          {!readonly && onRemove && (
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-100 text-red-600 rounded"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Image Display */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          {image.file_type.startsWith('image/') ? (
            <img
              src={image.file_url}
              alt={image.original_filename}
              className="max-w-full max-h-full object-contain transition-transform"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          ) : (
            <div className="text-center text-white">
              <FileText className="h-24 w-24 mx-auto mb-4" />
              <p>Cannot preview this file type</p>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100"
              >
                Download File
              </button>
            </div>
          )}
        </div>

        {/* Info Sidebar */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <div className="p-4">
            <h3 className="font-medium mb-4">Image Information</h3>
            
            {/* File Details */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm text-gray-600">Filename</label>
                <p className="font-medium break-words">{image.original_filename}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">File Size</label>
                <p className="font-medium">{formatFileSize(image.file_size)}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">File Type</label>
                <p className="font-medium">{image.file_type}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Uploaded</label>
                <p className="font-medium">{formatDate(image.upload_timestamp)}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-600">Description</label>
                {!readonly && (
                  <button
                    onClick={() => setEditingDescription(!editingDescription)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                )}
              </div>
              
              {editingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full p-2 border rounded-lg resize-none"
                    rows={3}
                    placeholder="Add a description..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateDescription}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingDescription(false);
                        setNewDescription(image.description || '');
                      }}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700">
                  {image.description || 'No description added'}
                </p>
              )}
            </div>

            {/* View Controls Info */}
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="font-medium text-blue-900 mb-2">View Controls</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Zoom:</strong> {Math.round(zoom * 100)}%</p>
                <p><strong>Rotation:</strong> {rotation}°</p>
                <p className="text-xs text-blue-600 mt-2">
                  Use the toolbar controls to zoom and rotate the image
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleImageViewer;