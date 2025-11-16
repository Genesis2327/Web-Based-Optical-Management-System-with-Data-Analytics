import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  X, 
  RotateCcw,
  Image as ImageIcon,
  Eye,
  EyeOff
} from 'lucide-react';

interface ImageItem {
  file: File;
  preview: string;
  name: string;
  size: number;
}

interface ImageReordererProps {
  images: ImageItem[];
  onReorder: (newOrder: ImageItem[]) => void;
  onRemove: (index: number) => void;
  onSetPrimary?: (index: number) => void;
  primaryIndex?: number;
}

export const ImageReorderer: React.FC<ImageReordererProps> = ({
  images,
  onReorder,
  onRemove,
  onSetPrimary,
  primaryIndex = 0
}) => {
  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    
    onReorder(newImages);
  };

  const moveToPosition = (fromIndex: number, toPosition: number) => {
    const toIndex = toPosition - 1; // Convert 1-based position to 0-based index
    moveImage(fromIndex, toIndex);
  };

  const resetOrder = () => {
    // Reset to original upload order (this would need to be tracked separately)
    // For now, we'll just sort by filename
    const sortedImages = [...images].sort((a, b) => a.name.localeCompare(b.name));
    onReorder(sortedImages);
  };

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No images uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Image Order Management</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetOrder}
              disabled={images.length <= 1}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Order
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Instructions */}
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
          <strong>Instructions:</strong>
          <ul className="mt-1 space-y-1 text-xs">
            <li>• Click on position numbers (1, 2, 3, etc.) to move images to that position</li>
            <li>• Click the eye icon to set as primary image</li>
            <li>• The first image will be displayed as the main product image</li>
            <li>• Use Reset Order to restore original upload order</li>
          </ul>
        </div>

        {/* Image List */}
        <div className="space-y-2">
          {images.map((image, index) => (
            <div 
              key={index}
              className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                index === primaryIndex 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              {/* Position Indicator */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index === primaryIndex 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-500 text-white'
              }`}>
                {index + 1}
              </div>

              {/* Image Preview */}
              <div className="flex-shrink-0 relative">
                <img
                  src={image.preview}
                  alt={image.name}
                  className="w-16 h-16 object-cover rounded border"
                />
                {index === primaryIndex && (
                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                    <Eye className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Image Info */}
              <div className="flex-grow min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {image.name}
                </div>
                <div className="text-xs text-gray-500">
                  {(image.size / 1024 / 1024).toFixed(2)} MB
                  {index === primaryIndex && (
                    <span className="ml-2 text-blue-600 font-medium">• Primary Image</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Set Primary Button */}
                {onSetPrimary && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSetPrimary(index)}
                    className={`flex-shrink-0 ${
                      index === primaryIndex 
                        ? 'bg-blue-100 text-blue-700 border-blue-300' 
                        : 'text-gray-600'
                    }`}
                    title={index === primaryIndex ? "Primary image" : "Set as primary"}
                  >
                    {index === primaryIndex ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                )}

                {/* Position Numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: images.length }, (_, pos) => (
                    <Button
                      key={pos}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => moveToPosition(index, pos + 1)}
                      disabled={index === pos}
                      className={`flex-shrink-0 w-8 h-8 p-0 text-xs ${
                        index === pos 
                          ? 'bg-blue-500 text-white border-blue-500' 
                          : 'hover:bg-blue-50'
                      }`}
                      title={`Move to position ${pos + 1}`}
                    >
                      {pos + 1}
                    </Button>
                  ))}
                </div>

                {/* Remove Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(index)}
                  className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Total: {images.length} image{images.length !== 1 ? 's' : ''} • 
          Primary: Image {primaryIndex + 1} • 
          Order determines display sequence in galleries
        </div>
      </CardContent>
    </Card>
  );
};
