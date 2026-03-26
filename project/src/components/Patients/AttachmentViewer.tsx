import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, Trash2, Edit, Upload, Calendar, User, Folder } from 'lucide-react';
import { attachments } from '../../utils/supabase';

interface Attachment {
  id: string;
  patient_id: string;
  lab_id?: string;
  related_table: string;
  related_id: string;
  file_url: string;
  file_path: string;
  original_filename: string;
  stored_filename: string;
  file_type: string;
  file_size: number;
  description?: string;
  uploaded_by?: string;
  upload_timestamp: string;
  created_at: string;
}

interface AttachmentViewerProps {
  patientId: string;
  relatedTable?: string;
  relatedId?: string;
  onUpload?: () => void;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  patientId,
  relatedTable,
  relatedId,
  onUpload
}) => {
  const [attachmentList, setAttachmentList] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadAttachments();
  }, [patientId, relatedTable, relatedId]);

  const loadAttachments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let data, error;
      
      if (relatedTable && relatedId) {
        // Get attachments for specific related entity
        ({ data, error } = await attachments.getByRelatedId(relatedTable, relatedId));
      } else {
        // Get all attachments for patient
        ({ data, error } = await attachments.getByPatientId(patientId));
      }
      
      if (error) {
        setError(error.message);
      } else {
        setAttachmentList(data || []);
      }
    } catch (err) {
      setError('Failed to load attachments');
      console.error('Error loading attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    // Open file in new tab for download
    window.open(attachment.file_url, '_blank');
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return;
    }
    
    try {
      const { error } = await attachments.delete(attachmentId);
      
      if (error) {
        setError('Failed to delete attachment: ' + error.message);
      } else {
        setAttachmentList(prev => prev.filter(att => att.id !== attachmentId));
      }
    } catch (err) {
      setError('Failed to delete attachment');
      console.error('Error deleting attachment:', err);
    }
  };

  const handleUpdateDescription = async (attachmentId: string) => {
    try {
      const { error } = await attachments.updateDescription(attachmentId, newDescription);
      
      if (error) {
        setError('Failed to update description: ' + error.message);
      } else {
        setAttachmentList(prev => prev.map(att => 
          att.id === attachmentId 
            ? { ...att, description: newDescription }
            : att
        ));
        setEditingDescription(null);
        setNewDescription('');
      }
    } catch (err) {
      setError('Failed to update description');
      console.error('Error updating description:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Eye className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-red-700 text-sm">{error}</div>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-xs mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900 flex items-center">
          <Folder className="h-5 w-5 mr-2 text-blue-500" />
          Attachments ({attachmentList.length})
        </h4>
        {onUpload && (
          <button
            onClick={onUpload}
            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </button>
        )}
      </div>

      {attachmentList.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No attachments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attachmentList.map((attachment) => (
            <div key={attachment.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    {getFileIcon(attachment.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {attachment.original_filename}
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Stored as: {attachment.stored_filename}</div>
                      <div>Size: {formatFileSize(attachment.file_size)} • Type: {attachment.file_type}</div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(attachment.upload_timestamp).toLocaleString()}
                      </div>
                      {attachment.lab_id && (
                        <div className="flex items-center">
                          <Folder className="h-3 w-3 mr-1" />
                          Lab: {attachment.lab_id}
                        </div>
                      )}
                    </div>
                    {editingDescription === attachment.id ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder="Enter description..."
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateDescription(attachment.id)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingDescription(null);
                              setNewDescription('');
                            }}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-gray-600">
                        {attachment.description || 'No description'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingDescription(attachment.id);
                      setNewDescription(attachment.description || '');
                    }}
                    className="text-gray-600 hover:text-gray-800 p-1 rounded"
                    title="Edit Description"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="text-red-600 hover:text-red-800 p-1 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentViewer;