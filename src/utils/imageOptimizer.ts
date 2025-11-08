import imageCompression from 'browser-image-compression';

interface OptimizationStats {
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercent: number;
}

interface OptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  useWebWorker?: boolean;
}

/**
 * Advanced image compression using browser-image-compression library
 */
export async function compressImageAdvanced(
  file: File,
  options: OptimizationOptions = {}
): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const {
    maxSizeMB = 2,
    maxWidthOrHeight = 2048,
    quality = 0.85,
    useWebWorker = true,
    format
  } = options;

  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker,
    initialQuality: quality,
    alwaysKeepResolution: false,
    fileType: format ? `image/${format}` : (file.type || 'image/jpeg')
  };

  try {
    const compressedFile = await imageCompression(file, compressionOptions);
    
    // Only return compressed version if it's actually smaller
    if (compressedFile.size < file.size) {
      console.log(`Image compressed: ${file.name}`, {
        original: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        compressed: `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
        reduction: `${Math.round((1 - compressedFile.size / file.size) * 100)}%`
      });
      return compressedFile;
    }
    
    console.log(`Image optimization skipped for ${file.name} (already optimal)`);
    return file;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file; // Return original on failure
  }
}

/**
 * Smart optimization based on file size and type
 */
export async function smartOptimizeImage(file: File): Promise<{ 
  file: File; 
  stats: OptimizationStats | null;
}> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return { 
      file, 
      stats: null 
    };
  }

  const originalSize = file.size;
  const sizeMB = originalSize / (1024 * 1024);
  
  // Skip if already very small
  if (sizeMB < 0.5) {
    return { 
      file, 
      stats: null 
    };
  }
  
  // Progressive optimization based on size
  let options: OptimizationOptions = {};
  
  if (sizeMB > 15) {
    // Very large: aggressive compression
    options = { 
      maxSizeMB: 2, 
      maxWidthOrHeight: 1920, 
      quality: 0.70,
      format: 'jpeg' // Force JPEG for large files
    };
  } else if (sizeMB > 10) {
    // Large: strong compression
    options = { 
      maxSizeMB: 2.5, 
      maxWidthOrHeight: 1920, 
      quality: 0.75 
    };
  } else if (sizeMB > 5) {
    // Medium-large: moderate compression
    options = { 
      maxSizeMB: 3, 
      maxWidthOrHeight: 2048, 
      quality: 0.80 
    };
  } else if (sizeMB > 2) {
    // Medium: light compression
    options = { 
      maxSizeMB: 3.5, 
      maxWidthOrHeight: 2560, 
      quality: 0.85 
    };
  } else {
    // Small-Medium: minimal compression
    options = { 
      maxSizeMB: 4, 
      maxWidthOrHeight: 3000, 
      quality: 0.90 
    };
  }
  
  const optimizedFile = await compressImageAdvanced(file, options);
  
  const stats: OptimizationStats = {
    originalSize,
    optimizedSize: optimizedFile.size,
    savedBytes: originalSize - optimizedFile.size,
    savedPercent: Math.round((1 - optimizedFile.size / originalSize) * 100)
  };
  
  return { 
    file: optimizedFile, 
    stats: optimizedFile.size < originalSize ? stats : null 
  };
}

/**
 * Batch optimize multiple images with progress tracking
 */
export async function optimizeBatch(
  files: File[],
  onProgress?: (progress: number, currentFile: string) => void
): Promise<{
  files: File[];
  totalStats: OptimizationStats;
  individualStats: (OptimizationStats | null)[];
}> {
  const results: { file: File; stats: OptimizationStats | null }[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (onProgress) {
      onProgress((i / files.length) * 100, file.name);
    }
    
    const result = await smartOptimizeImage(file);
    results.push(result);
  }
  
  if (onProgress) {
    onProgress(100, 'Complete');
  }
  
  // Calculate total statistics
  const totalOriginal = results.reduce((sum, r) => sum + (r.stats?.originalSize || r.file.size), 0);
  const totalOptimized = results.reduce((sum, r) => sum + r.file.size, 0);
  
  const totalStats: OptimizationStats = {
    originalSize: totalOriginal,
    optimizedSize: totalOptimized,
    savedBytes: totalOriginal - totalOptimized,
    savedPercent: Math.round((1 - totalOptimized / totalOriginal) * 100)
  };
  
  return {
    files: results.map(r => r.file),
    totalStats,
    individualStats: results.map(r => r.stats)
  };
}

/**
 * Get optimization recommendation based on file properties
 */
export function getOptimizationRecommendation(file: File): {
  recommended: boolean;
  reason: string;
  estimatedReduction?: number;
} {
  if (!file.type.startsWith('image/')) {
    return {
      recommended: false,
      reason: 'Not an image file'
    };
  }
  
  const sizeMB = file.size / (1024 * 1024);
  
  if (sizeMB < 0.5) {
    return {
      recommended: false,
      reason: 'File is already small'
    };
  }
  
  if (sizeMB > 10) {
    return {
      recommended: true,
      reason: 'Large file - significant size reduction expected',
      estimatedReduction: 60
    };
  }
  
  if (sizeMB > 5) {
    return {
      recommended: true,
      reason: 'Medium file - moderate size reduction expected',
      estimatedReduction: 40
    };
  }
  
  if (sizeMB > 2) {
    return {
      recommended: true,
      reason: 'File can be optimized for faster upload',
      estimatedReduction: 25
    };
  }
  
  return {
    recommended: true,
    reason: 'Light optimization recommended',
    estimatedReduction: 15
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Export types for use in components
 */
export type { OptimizationStats, OptimizationOptions };