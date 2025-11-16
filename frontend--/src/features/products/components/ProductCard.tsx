import React from 'react';
import { Product } from '../types/product.types';
import { getStorageUrl } from '../../../utils/imageUtils';

interface ProductCardProps {
  product: Product;
  onReserve?: (productId: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: number) => void;
  onManageStock?: (product: Product) => void;
  userRole?: string;
  reservationCount?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onReserve,
  onEdit,
  onDelete,
  onManageStock,
  userRole,
  reservationCount = 0
}) => {
  const displayImage = product.primary_image || (product.image_paths && product.image_paths[0]) || '';

  return (
    <div className="border rounded p-4 flex flex-col">
      {/* Product Image */}
      {displayImage ? (
        <div className="mb-2 aspect-[4/3] bg-gray-200 rounded overflow-hidden">
          <img
            className="w-full h-full object-cover"
            src={getStorageUrl(displayImage)}
            alt={product.name}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `data:image/svg+xml;base64,${btoa(`
                <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#f3f4f6"/>
                  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">
                    ${product.name}
                  </text>
                </svg>
              `)}`;
            }}
          />
        </div>
      ) : (
        <div className="mb-2 aspect-[4/3] bg-gray-200 flex items-center justify-center text-gray-500">
          No Images
        </div>
      )}

      {/* Product Info */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">{product.name}</h3>
        <p className="text-sm text-gray-600">SKU: {product.sku || 'N/A'}</p>
        <p className="text-sm text-gray-600">{product.description}</p>
        
        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-2xl font-bold text-blue-600">₱{Number(product.price || 0).toFixed(2)}</p>
        </div>
        
        <p className="text-sm text-gray-600">
          Availability: <span className="text-green-600 font-semibold">{product.stock_quantity} in stock</span>
        </p>
        
        {/* Multi-Device Compatibility - Customer Role Only */}
        {userRole === 'customer' && product.attributes?.multi_device_compatibility && (
          <div className="mt-2 sm:mt-2.5 pt-2 sm:pt-2.5 border-t border-gray-200">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2 flex items-center">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">Device Compatibility</span>
            </p>
            {Array.isArray(product.attributes.multi_device_compatibility) ? (
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {product.attributes.multi_device_compatibility.slice(0, 3).map((device: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap"
                  >
                    {device}
                  </span>
                ))}
                {product.attributes.multi_device_compatibility.length > 3 && (
                  <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium text-blue-600">
                    +{product.attributes.multi_device_compatibility.length - 3} more
                  </span>
                )}
              </div>
            ) : typeof product.attributes.multi_device_compatibility === 'string' ? (
              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 break-words">{product.attributes.multi_device_compatibility}</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Branch Availability Button */}
      <div className="mt-3">
        <button className="w-full py-2 px-3 text-sm text-gray-600 border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Check branch availability
          </div>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Action Buttons */}
      {userRole === 'customer' && product.is_active && (
        <div className="mt-4 flex items-center gap-3">
          {/* Wishlist Button */}
          <button className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Reservation Button */}
          <button
            onClick={() => onReserve?.(product.id)}
            disabled={product.stock_quantity <= 0}
            className={`w-full py-3 px-4 text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
              product.stock_quantity <= 0
                ? 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {product.stock_quantity <= 0 ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Out of Stock
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Reserve
              </>
            )}
          </button>
        </div>
      )}

      {(userRole === 'admin' || userRole === 'staff') && (
        <div className="flex flex-col space-y-2 mt-2">
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit?.(product)}
              className="flex-1 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(product.id)}
              className="flex-1 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              Delete
            </button>
          </div>
          <button
            onClick={() => onManageStock?.(product)}
            className="w-full bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            Manage Stock
          </button>
        </div>
      )}
    </div>
  );
};
