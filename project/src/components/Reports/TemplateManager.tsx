import React, { useState } from 'react';
import { X, Plus, Edit, Save, Trash2, Copy, FileText, Palette, Settings } from 'lucide-react';
import { LabTemplate, saveLabTemplate, getLabTemplates, defaultLabTemplate } from '../../utils/pdfGenerator';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelected?: (template: LabTemplate) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({ isOpen, onClose, onTemplateSelected }) => {
  const [templates, setTemplates] = useState<LabTemplate[]>(getLabTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState<LabTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LabTemplate | null>(null);

  const handleCreateNew = () => {
    const newTemplate: LabTemplate = {
      ...defaultLabTemplate,
      id: `template_${Date.now()}`,
      name: 'New Template',
    };
    setEditingTemplate(newTemplate);
    setIsEditing(true);
  };

  const handleEdit = (template: LabTemplate) => {
    setEditingTemplate({ ...template });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editingTemplate) {
      saveLabTemplate(editingTemplate);
      setTemplates(getLabTemplates());
      setIsEditing(false);
      setEditingTemplate(null);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingTemplate(null);
  };

  const handleDuplicate = (template: LabTemplate) => {
    const duplicatedTemplate: LabTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      name: `${template.name} (Copy)`,
    };
    saveLabTemplate(duplicatedTemplate);
    setTemplates(getLabTemplates());
  };

  const handleDelete = (templateId: string) => {
    if (templateId === 'medilab-default') {
      alert('Cannot delete the default template');
      return;
    }
    
    if (confirm('Are you sure you want to delete this template?')) {
      const updatedTemplates = templates.filter(t => t.id !== templateId);
      localStorage.setItem('lims_lab_templates', JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (!editingTemplate) return;
    
    const keys = field.split('.');
    const updatedTemplate = { ...editingTemplate };
    
    if (keys.length === 2) {
      (updatedTemplate as any)[keys[0]][keys[1]] = value;
    } else {
      (updatedTemplate as any)[field] = value;
    }
    
    setEditingTemplate(updatedTemplate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-2 text-blue-600" />
            Lab Report Templates
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-1 rounded"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {!isEditing ? (
            <>
              {/* Template List */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Available Templates</h3>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      {template.id === 'medilab-default' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div><strong>Lab:</strong> {template.header.labName}</div>
                      <div><strong>Address:</strong> {template.header.address}</div>
                      <div><strong>Phone:</strong> {template.header.phone}</div>
                      <div><strong>Email:</strong> {template.header.email}</div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="flex-1 flex items-center justify-center px-3 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="flex items-center justify-center px-3 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {template.id !== 'medilab-default' && (
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="flex items-center justify-center px-3 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Template Editor */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingTemplate?.id.includes('template_') ? 'Create New Template' : 'Edit Template'}
                </h3>
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </button>
                </div>
              </div>

              {editingTemplate && (
                <div className="space-y-8">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Settings className="h-5 w-5 mr-2" />
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Template Name
                        </label>
                        <input
                          type="text"
                          value={editingTemplate.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Header Information */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-blue-900 mb-4">Header Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lab Name
                        </label>
                        <input
                          type="text"
                          value={editingTemplate.header.labName}
                          onChange={(e) => handleInputChange('header.labName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address
                        </label>
                        <input
                          type="text"
                          value={editingTemplate.header.address}
                          onChange={(e) => handleInputChange('header.address', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="text"
                          value={editingTemplate.header.phone}
                          onChange={(e) => handleInputChange('header.phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editingTemplate.header.email}
                          onChange={(e) => handleInputChange('header.email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Information */}
                  <div className="bg-green-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-green-900 mb-4">Footer Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Authorized By
                        </label>
                        <input
                          type="text"
                          value={editingTemplate.footer.authorizedBy}
                          onChange={(e) => handleInputChange('footer.authorizedBy', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Signature Text
                        </label>
                        <input
                          type="text"
                          value={editingTemplate.footer.signature}
                          onChange={(e) => handleInputChange('footer.signature', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Disclaimer (Optional)
                        </label>
                        <textarea
                          value={editingTemplate.footer.disclaimer || ''}
                          onChange={(e) => handleInputChange('footer.disclaimer', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Styling */}
                  <div className="bg-purple-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-purple-900 mb-4 flex items-center">
                      <Palette className="h-5 w-5 mr-2" />
                      Styling Options
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Primary Color
                        </label>
                        <input
                          type="color"
                          value={editingTemplate.styling.primaryColor}
                          onChange={(e) => handleInputChange('styling.primaryColor', e.target.value)}
                          className="w-full h-10 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Secondary Color
                        </label>
                        <input
                          type="color"
                          value={editingTemplate.styling.secondaryColor}
                          onChange={(e) => handleInputChange('styling.secondaryColor', e.target.value)}
                          className="w-full h-10 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Font Family
                        </label>
                        <select
                          value={editingTemplate.styling.fontFamily}
                          onChange={(e) => handleInputChange('styling.fontFamily', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="Arial, sans-serif">Arial</option>
                          <option value="Times New Roman, serif">Times New Roman</option>
                          <option value="Helvetica, sans-serif">Helvetica</option>
                          <option value="Georgia, serif">Georgia</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;