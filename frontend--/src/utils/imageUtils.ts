/**
 * Utility functions for handling image URLs
 */

/**
 * Get the correct storage URL for an image path
 * @param path - The image path from the database
 * @returns The full URL to access the image
 */
export const getStorageUrl = (path: string): string => {
  if (!path) return '';
  
  // If it's already a full URL, return as is
  if (path.startsWith('http')) {
    return path;
  }
  
  // If it's a base64 data URL, return as is
  if (path.startsWith('data:')) {
    return path;
  }
  
  // Get the API base URL and construct the storage URL
  const apiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
  const baseUrl = apiBaseUrl.replace('/api', '');
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  return `${baseUrl}/storage/${cleanPath}`;
};

/**
 * Check if an image URL is valid
 * @param url - The image URL to check
 * @returns Promise<boolean> - Whether the image exists and is accessible
 */
export const isValidImageUrl = async (url: string): Promise<boolean> => {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get a fallback image URL when the primary image fails to load
 * @param productName - The name of the product for alt text
 * @param size - The size of the placeholder (width x height)
 * @returns A placeholder image URL
 */
export const getFallbackImageUrl = (productName: string, size: string = '400x300'): string => {
  // Create a data URI for a simple placeholder instead of relying on external services
  const [width, height] = size.split('x').map(Number);
  const text = encodeURIComponent(productName || 'N/A');
  
  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle" dy=".3em">
        ${text}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// ==============================
// COLOR DETECTION UTILITIES
// ==============================

export interface ColorInfo {
  name: string;
  rgb: { r: number; g: number; b: number };
  hex: string;
  percentage: number;
}

export interface ImageAnalysisResult {
  dominantColor: ColorInfo;
  palette: ColorInfo[];
  suggestedCategory: string;
  suggestedColors: string[];
  confidence: number;
}

/**
 * Extract dominant color from an image file
 */
export const extractDominantColor = async (file: File): Promise<ColorInfo> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Resize image for faster processing
      const maxSize = 100;
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      // Color frequency map
      const colorMap = new Map<string, number>();

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip transparent and near-white/near-black pixels
        if (a < 125 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) {
          continue;
        }

        // Group similar colors
        const rBucket = Math.floor(r / 10) * 10;
        const gBucket = Math.floor(g / 10) * 10;
        const bBucket = Math.floor(b / 10) * 10;
        const key = `${rBucket},${gBucket},${bBucket}`;

        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }

      // Find most common color
      let maxCount = 0;
      let dominantRgb = { r: 0, g: 0, b: 0 };

      colorMap.forEach((count, key) => {
        if (count > maxCount) {
          maxCount = count;
          const [r, g, b] = key.split(',').map(Number);
          dominantRgb = { r, g, b };
        }
      });

      const colorInfo = {
        name: rgbToColorName(dominantRgb),
        rgb: dominantRgb,
        hex: rgbToHex(dominantRgb.r, dominantRgb.g, dominantRgb.b),
        percentage: (maxCount / (pixels.length / 4)) * 100,
      };

      resolve(colorInfo);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Extract color palette from image
 */
export const extractColorPalette = async (file: File, numColors: number = 5): Promise<ColorInfo[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      const maxSize = 150;
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      // K-means clustering for color palette
      const colorMap = new Map<string, number>();

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 125 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) {
          continue;
        }

        const rBucket = Math.floor(r / 20) * 20;
        const gBucket = Math.floor(g / 20) * 20;
        const bBucket = Math.floor(b / 20) * 20;
        const key = `${rBucket},${gBucket},${bBucket}`;

        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }

      // Sort by frequency and get top colors
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, numColors);

      const totalPixels = pixels.length / 4;
      const palette = sortedColors.map(([key, count]) => {
        const [r, g, b] = key.split(',').map(Number);
        const rgb = { r, g, b };
        return {
          name: rgbToColorName(rgb),
          rgb,
          hex: rgbToHex(r, g, b),
          percentage: (count / totalPixels) * 100,
        };
      });

      resolve(palette);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Analyze image and suggest category and colors
 */
export const analyzeImage = async (file: File): Promise<ImageAnalysisResult> => {
  try {
    const palette = await extractColorPalette(file, 5);
    const dominantColor = palette[0] || {
      name: 'Unknown',
      rgb: { r: 0, g: 0, b: 0 },
      hex: '#000000',
      percentage: 0,
    };

    // Suggest category based on filename
    const suggestedCategory = suggestCategoryFromFilename(file.name);
    
    // Extract all color names from palette
    const suggestedColors = palette.map(c => c.name).filter((v, i, a) => a.indexOf(v) === i);

    return {
      dominantColor,
      palette,
      suggestedCategory,
      suggestedColors,
      confidence: palette.length > 0 ? 0.8 : 0.3,
    };
  } catch (error) {
    console.error('Image analysis failed:', error);
    return {
      dominantColor: {
        name: 'Unknown',
        rgb: { r: 0, g: 0, b: 0 },
        hex: '#000000',
        percentage: 0,
      },
      palette: [],
      suggestedCategory: 'Frames',
      suggestedColors: ['Unknown'],
      confidence: 0,
    };
  }
};

/**
 * Convert RGB to hex color
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

/**
 * Convert RGB to color name
 */
const rgbToColorName = (rgb: { r: number; g: number; b: number }): string => {
  const { r, g, b } = rgb;

  // Define color ranges
  const colors = [
    { name: 'Black', check: () => r < 50 && g < 50 && b < 50 },
    { name: 'White', check: () => r > 200 && g > 200 && b > 200 },
    { name: 'Gray', check: () => Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30 },
    { name: 'Red', check: () => r > 150 && g < 100 && b < 100 },
    { name: 'Pink', check: () => r > 180 && g < 150 && b > 100 && b < 200 },
    { name: 'Orange', check: () => r > 200 && g > 100 && g < 180 && b < 100 },
    { name: 'Yellow', check: () => r > 200 && g > 200 && b < 150 },
    { name: 'Green', check: () => g > 150 && r < 150 && b < 150 },
    { name: 'Cyan', check: () => g > 150 && b > 150 && r < 100 },
    { name: 'Blue', check: () => b > 150 && r < 100 && g < 150 },
    { name: 'Purple', check: () => r > 100 && b > 150 && g < 150 },
    { name: 'Brown', check: () => r > 100 && r < 180 && g > 50 && g < 130 && b > 20 && b < 100 },
    { name: 'Gold', check: () => r > 180 && g > 140 && g < 200 && b < 100 },
    { name: 'Silver', check: () => r > 150 && g > 150 && b > 150 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20 },
  ];

  for (const color of colors) {
    if (color.check()) {
      return color.name;
    }
  }

  return 'Mixed';
};

/**
 * Suggest category from filename
 */
const suggestCategoryFromFilename = (filename: string): string => {
  const lower = filename.toLowerCase();
  
  if (lower.includes('sunglass') || lower.includes('sun')) return 'Sunglasses';
  if (lower.includes('contact') || lower.includes('lens')) return 'Contact Lenses';
  if (lower.includes('solution') || lower.includes('care')) return 'Solutions';
  if (lower.includes('frame') || lower.includes('glass') || lower.includes('eyewear')) return 'Frames';
  
  return 'Frames'; // Default
};

/**
 * Batch analyze multiple images
 */
export const batchAnalyzeImages = async (
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ImageAnalysisResult>> => {
  const results = new Map<string, ImageAnalysisResult>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const analysis = await analyzeImage(file);
      results.set(file.name, analysis);
      
      if (onProgress) {
        onProgress(i + 1, files.length);
      }
    } catch (error) {
      console.error(`Failed to analyze ${file.name}:`, error);
    }
  }

  return results;
};
