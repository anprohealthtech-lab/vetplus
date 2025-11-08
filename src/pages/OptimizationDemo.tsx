import React, { useState } from 'react';
import { Upload, Image as ImageIcon, FileText, Download, Zap } from 'lucide-react';

const OptimizationDemo: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [optimizedFiles, setOptimizedFiles] = useState<{ original: File; optimized: File; stats: any }[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState<{ progress: number; fileName: string } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setOptimizedFiles([]);
  };

  const optimizeFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsOptimizing(true);
    setOptimizedFiles([]);

    try {
      const { optimizeBatch } = await import('../utils/imageOptimizer');
      
      const result = await optimizeBatch(selectedFiles, (progress: number, fileName: string) => {
        setOptimizationProgress({ progress, fileName });
      });

      const optimizedResults = selectedFiles.map((originalFile, index) => ({
        original: originalFile,
        optimized: result.files[index],
        stats: result.results[index]
      }));

      setOptimizedFiles(optimizedResults);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress(null);
    }
  };

  const downloadFile = (file: File, suffix: string = '') => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    const name = file.name;
    const nameParts = name.split('.');
    const extension = nameParts.pop();
    const baseName = nameParts.join('.');
    a.href = url;
    a.download = `${baseName}${suffix}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Zap className="h-8 w-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">Image Optimization Demo</h1>
              <p className="text-blue-100">Test client-side image compression and optimization</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* File Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Images to Optimize
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="file-input"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">
                  Click to select images
                </p>
                <p className="text-sm text-gray-500">
                  Support JPG, PNG, WebP, GIF formats
                </p>
              </label>
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Selected Files ({selectedFiles.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center space-x-3">
                      <ImageIcon className="h-8 w-8 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optimize Button */}
              <div className="mt-4 text-center">
                <button
                  onClick={optimizeFiles}
                  disabled={isOptimizing}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isOptimizing ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 inline-block" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2 inline-block" />
                      Optimize Images
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Optimization Progress */}
          {optimizationProgress && (
            <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                <span>Optimizing {optimizationProgress.fileName}...</span>
                <span className="font-medium">{Math.round(optimizationProgress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${optimizationProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {optimizedFiles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Optimization Results
              </h3>
              
              {/* Summary */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {optimizedFiles.length}
                    </p>
                    <p className="text-sm text-gray-600">Files Processed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatBytes(
                        optimizedFiles.reduce((sum, file) => sum + file.original.size, 0)
                      )}
                    </p>
                    <p className="text-sm text-gray-600">Original Size</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatBytes(
                        optimizedFiles.reduce((sum, file) => sum + file.optimized.size, 0)
                      )}
                    </p>
                    <p className="text-sm text-gray-600">Optimized Size</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {Math.round(
                        ((optimizedFiles.reduce((sum, file) => sum + file.original.size, 0) -
                          optimizedFiles.reduce((sum, file) => sum + file.optimized.size, 0)) /
                          optimizedFiles.reduce((sum, file) => sum + file.original.size, 0)) * 100
                      )}%
                    </p>
                    <p className="text-sm text-gray-600">Space Saved</p>
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-4">
                {optimizedFiles.map((result, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* File Info */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          {result.original.name}
                        </h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Type: {result.original.type}</p>
                          <p>Optimization: {result.stats?.strategy || 'Auto'}</p>
                          {result.stats?.processingTime && (
                            <p>Time: {result.stats.processingTime}ms</p>
                          )}
                        </div>
                      </div>

                      {/* Size Comparison */}
                      <div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Original:</span>
                            <span className="font-medium">{formatBytes(result.original.size)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Optimized:</span>
                            <span className="font-medium">{formatBytes(result.optimized.size)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-sm text-gray-600">Saved:</span>
                            <span className="font-bold text-green-600">
                              {Math.round(((result.original.size - result.optimized.size) / result.original.size) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => downloadFile(result.original, '_original')}
                          className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
                        >
                          <Download className="h-4 w-4 mr-1 inline-block" />
                          Original
                        </button>
                        <button
                          onClick={() => downloadFile(result.optimized, '_optimized')}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                        >
                          <Download className="h-4 w-4 mr-1 inline-block" />
                          Optimized
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizationDemo;