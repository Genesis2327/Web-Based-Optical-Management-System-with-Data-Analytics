import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Product, BranchAvailability } from '../types/product.types';
import { getProduct } from '../../../services/productApi';
import { getStorageUrl, getFallbackImageUrl } from '../../../utils/imageUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ProductWithAvailability extends Product {
  branch_availability?: BranchAvailability[];
}

const FAVORITES_KEY = 'product_favorites';

const ProductDetails: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductWithAvailability | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [reservationLoading, setReservationLoading] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [zoomState, setZoomState] = useState<{isZooming: boolean, x: number, y: number}>({isZooming: false, x: 0, y: 0});
  const [showZoomModal, setShowZoomModal] = useState<boolean>(false);

  // Load favorite status
  useEffect(() => {
    if (productId) {
      try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
          const favorites: number[] = JSON.parse(stored);
          setIsFavorite(favorites.includes(Number(productId)));
        }
      } catch (error) {
        console.error('Error loading favorite status:', error);
      }
    }
  }, [productId]);

  const toggleFavorite = () => {
    if (!productId) return;
    
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      let favorites: number[] = stored ? JSON.parse(stored) : [];
      const productIdNum = Number(productId);
      
      if (isFavorite) {
        favorites = favorites.filter(id => id !== productIdNum);
        toast.success('Removed from favorites');
      } else {
        if (!favorites.includes(productIdNum)) {
          favorites.push(productIdNum);
        }
        toast.success('Added to favorites');
      }
      
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { getApiBaseUrlDynamic } = await import('@/config/api');
        const API_BASE_URL = getApiBaseUrlDynamic();
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
          headers: {
            'Authorization': sessionStorage.getItem('auth_token') ? `Bearer ${sessionStorage.getItem('auth_token')}` : ''
          }
        });

        if (!response.ok) {
          throw new Error('Product not found');
        }

        const data = await response.json();
        console.log('Product data received:', data);
        console.log('Branch availability:', data.branch_availability);
        setProduct(data);
        
        // Set default branch if available
        if (data.branch_availability && Array.isArray(data.branch_availability) && data.branch_availability.length > 0) {
          const firstAvailable = data.branch_availability.find((ba: BranchAvailability) => ba.is_available);
          if (firstAvailable && firstAvailable.branch) {
            setSelectedBranch(firstAvailable.branch.id);
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const availableBranches = product?.branch_availability?.filter(ba => 
    ba.is_available && 
    ba.branch && 
    ba.branch.id && 
    ba.branch.name
  ) || [];

  const getMaxQuantity = () => {
    if (!selectedBranch) return 1;
    const branchAvailability = product?.branch_availability?.find(
      ba => ba.branch && ba.branch.id === selectedBranch
    );
    return branchAvailability?.available_quantity || 1;
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!user) {
      toast.error('Please log in to create a reservation');
      return;
    }
    
    if (!selectedBranch) {
      toast.error('Please select a branch to reserve this product');
      return;
    }
    
    if (!product) {
      toast.error('Product information is missing');
      return;
    }
    
    if (quantity < 1 || quantity > getMaxQuantity()) {
      toast.error(`Quantity must be between 1 and ${getMaxQuantity()}`);
      return;
    }

    setReservationLoading(true);

    try {
      const { getApiBaseUrlDynamic } = await import('@/config/api');
      const API_BASE_URL = getApiBaseUrlDynamic();
      const token = sessionStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      console.log('Creating reservation with data:', {
        product_id: product.id,
        branch_id: selectedBranch,
        quantity: quantity,
        notes: notes || null,
      });
      
      const res = await fetch(`${API_BASE_URL}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: product.id,
          branch_id: selectedBranch,
          quantity: quantity,
          notes: notes || null,
        })
      });

      const responseData = await res.json().catch(() => null);

      if (!res.ok) {
        // Handle validation errors
        if (res.status === 422 && responseData?.errors) {
          const validationErrors = Object.values(responseData.errors).flat().join(', ');
          throw new Error(validationErrors || responseData?.message || 'Validation failed');
        }
        
        const errorMessage = responseData?.message || responseData?.error || `Failed to create reservation (Status: ${res.status})`;
        throw new Error(errorMessage);
      }

      console.log('Reservation created successfully:', responseData);
      toast.success('Reservation created successfully! You will be notified when it\'s ready for pickup.');
      
      // Reset form
      setQuantity(1);
      setNotes('');
      setSelectedBranch(null);
      
      // Reload product to update availability
      if (productId) {
        const { getApiBaseUrlDynamic } = await import('@/config/api');
        const API_BASE_URL = getApiBaseUrlDynamic();
        const refreshResponse = await fetch(`${API_BASE_URL}/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setProduct(refreshedData);
        }
      }
      
      // Optionally navigate to reservations page
      // navigate('/customer/reservations');
    } catch (error) {
      console.error('Reservation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create reservation';
      toast.error(errorMessage);
    } finally {
      setReservationLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Loading Product</h3>
              <p className="text-gray-500">Fetching product details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <h3 className="text-2xl font-semibold text-gray-700 mb-3">Product Not Found</h3>
            <p className="text-gray-500 mb-6">The product you're looking for doesn't exist or is no longer available.</p>
            <button
              onClick={() => navigate('/customer/products')}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Back to Gallery
            </button>
          </div>
        </div>
      </div>
    );
  }

  const images = product.image_order || product.image_paths || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
      <button
        onClick={() => navigate('/customer/products')}
          className="mb-6 inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        Back to Gallery
      </button>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Images */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Main Image with Zoom */}
            <div 
              className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 cursor-zoom-in group"
              onMouseMove={(e) => {
                if (zoomState.isZooming && images.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setZoomState({ isZooming: true, x, y });
                }
              }}
              onMouseEnter={() => {
                if (images.length > 0) {
                  setZoomState({ isZooming: true, x: 50, y: 50 });
                }
              }}
              onMouseLeave={() => {
                setZoomState({ isZooming: false, x: 0, y: 0 });
              }}
              onClick={() => images.length > 0 && setShowZoomModal(true)}
            >
              {images.length > 0 ? (
                <>
                  <img
                    src={getStorageUrl(images[selectedImageIndex])}
                alt={`${product.name} ${selectedImageIndex + 1}`}
                    className={`w-full h-full object-contain transition-transform duration-300 ${
                      zoomState.isZooming ? 'scale-150' : 'scale-100'
                    }`}
                    style={{
                      transformOrigin: `${zoomState.x}% ${zoomState.y}%`
                    }}
                    onError={(e) => {
                      e.currentTarget.src = getFallbackImageUrl(product.name, '800x800');
                    }}
                  />
                  
                  {/* Zoom Indicator */}
                  {!zoomState.isZooming && (
                    <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm text-gray-700 text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center space-x-2 shadow-sm pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m3-3H9" />
                      </svg>
                      <span>Hover to zoom • Click to enlarge</span>
                    </div>
                  )}
                  
                  {zoomState.isZooming && (
                    <div className="absolute top-4 right-4 bg-blue-500/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-md flex items-center space-x-2 shadow-lg pointer-events-none">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>2x Zoom</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
              </div>
            )}
          </div>

          {/* Thumbnails */}
            {images.length > 1 && (
              <div className="p-4 bg-gray-50">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {images.map((imagePath, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`flex-shrink-0 relative transition-all duration-200 ${
                        index === selectedImageIndex ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-300'
                      }`}
                    >
                      <img
                        src={getStorageUrl(imagePath)}
                  alt={`Thumbnail ${index + 1}`}
                        className={`w-20 h-20 object-cover rounded-lg border-2 ${
                          index === selectedImageIndex ? 'border-blue-500' : 'border-gray-200'
                  }`}
                        onError={(e) => {
                          e.currentTarget.src = getFallbackImageUrl('N/A', '80x80');
                        }}
                />
                    </button>
              ))}
                </div>
            </div>
          )}
        </div>

          {/* Right Side - Product Info, Availability & Reservation Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Product Basic Info */}
            <div className="mb-6">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold text-gray-900 flex-1">{product.name}</h1>
                <button
                  onClick={toggleFavorite}
                  className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${
                      isFavorite
                        ? 'text-red-500 fill-current'
                        : 'text-gray-400 hover:text-red-400'
                    }`}
                    fill={isFavorite ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </button>
              </div>
              {product.description && (
                <p className="text-gray-600 mb-4">{product.description}</p>
              )}
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ₱{Number(product.price || 0).toFixed(2)}
              </span>
              </div>
          </div>

            {/* Multi-Device Compatibility - Customer Role Only */}
            {user?.role === 'customer' && product.attributes?.multi_device_compatibility && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Multi-Device Compatibility</h3>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  {Array.isArray(product.attributes.multi_device_compatibility) ? (
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {product.attributes.multi_device_compatibility.map((device: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 transition-all hover:bg-blue-200 hover:border-blue-300"
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="whitespace-nowrap">{device}</span>
                        </span>
                      ))}
                    </div>
                  ) : typeof product.attributes.multi_device_compatibility === 'string' ? (
                    <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{product.attributes.multi_device_compatibility}</p>
                  ) : (
                    <div className="space-y-2 sm:space-y-2.5">
                      {Object.entries(product.attributes.multi_device_compatibility).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-2.5 bg-white rounded-lg border border-blue-100 gap-1 sm:gap-0">
                          <span className="font-medium text-gray-700 text-sm sm:text-base">{key}:</span>
                          <span className="text-gray-600 text-sm sm:text-base break-words">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Branch Availability Check */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-lg font-semibold">Check Branch Availability</span>
                </div>
              </label>
              
              {availableBranches.length > 0 ? (
                <Select
                  value={selectedBranch?.toString() || ''}
                  onValueChange={(value) => setSelectedBranch(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a branch to check availability" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBranches.map((branchAvailability) => {
                      const branch = branchAvailability.branch;
                      if (!branch) return null;
                      
                      return (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          <div className="flex justify-between items-center w-full">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="font-medium">{branch.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-green-600 ml-4">
                              {branchAvailability.available_quantity} available
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">This product is currently not available at any branch.</p>
                </div>
              )}

              {/* Selected Branch Details */}
              {selectedBranch && (() => {
                const branchAvailability = product.branch_availability?.find(
                  ba => ba.branch && ba.branch.id === selectedBranch
                );
                const branch = branchAvailability?.branch;
                
                return branch ? (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">{branch.name}</h4>
                    {branch.address && (
                      <p className="text-sm text-blue-700 mb-1">
                        <span className="font-medium">Address:</span> {branch.address}
                      </p>
                    )}
                    {branch.phone && (
                      <p className="text-sm text-blue-700 mb-1">
                        <span className="font-medium">Phone:</span> {branch.phone}
                      </p>
                    )}
                    {branchAvailability && (
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Available Quantity:</span> {branchAvailability.available_quantity} pieces
                      </p>
                    )}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Reservation Form */}
            {user && availableBranches.length > 0 && (
              <form onSubmit={handleReservation} className="space-y-6 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Reserve Product</h3>
                
                {/* Branch Selection Info */}
                {selectedBranch && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                    <p className="text-sm text-green-800">
                      <strong>Selected Branch:</strong> {
                        product.branch_availability?.find(ba => ba.branch?.id === selectedBranch)?.branch?.name
                      }
                    </p>
                  </div>
                )}
                
                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={getMaxQuantity()}
                    value={quantity}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (value >= 1 && value <= getMaxQuantity()) {
                        setQuantity(value);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={!selectedBranch}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: {getMaxQuantity()} pieces {selectedBranch ? '' : '(Select a branch first)'}
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special requests or notes..."
                  />
          </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={reservationLoading || !selectedBranch || quantity < 1 || quantity > getMaxQuantity()}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {reservationLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Reservation...
                    </span>
                  ) : !selectedBranch ? (
                    'Select a Branch First'
                  ) : (
                    'Reserve Product'
                  )}
                </button>

                {/* Important Notice */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> This is a reservation only. You must visit the branch to complete your purchase and pay physically. No online payment is available.
                  </p>
                </div>
              </form>
            )}

            {!user && (
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  Please log in to reserve this product.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Modal */}
      {showZoomModal && images.length > 0 && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowZoomModal(false)}
        >
          <button
            onClick={() => setShowZoomModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
            aria-label="Close zoom"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-3 transition-colors"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-3 transition-colors"
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Zoomed Image */}
          <div 
            className="max-w-7xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getStorageUrl(images[selectedImageIndex])}
              alt={`${product.name} ${selectedImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
              onError={(e) => {
                e.currentTarget.src = getFallbackImageUrl(product.name, '1200x1200');
              }}
            />
          </div>
          
          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
              {selectedImageIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductDetails;
