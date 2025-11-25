import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Product } from '../types/product.types';
import { getProducts } from '../../../services/productApi';
import { useQuery } from '@tanstack/react-query';
import { getActiveBranches, Branch } from '@/services/branchApi';
import { getProductAvailability } from '@/services/branchAnalyticsApi';
import { getStorageUrl, getFallbackImageUrl } from '../../../utils/imageUtils';
import { RefreshCw } from 'lucide-react';
import { shouldSkipRefresh, clearDeletionProtection } from '../../../utils/deletionProtection';
import { API_BASE_URL } from '@/config/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductWithAvailability extends Product {
  // Product interface remains the same
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  product_count?: number;
  is_active?: boolean;
  sort_order?: number;
}

const FAVORITES_KEY = 'product_favorites';

const ProductGallery: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [favorites, setFavorites] = useState<number[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }, []);

  // Fetch real branches from API
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['activeBranches'],
    queryFn: getActiveBranches,
  });

  // Debug: Log branches when they're fetched
  useEffect(() => {
    if (branches && branches.length > 0) {
      console.log('[ProductGallery] ✅ Branches loaded from everbright_optical database:', branches.length);
      console.log('[ProductGallery] Branches details:', branches.map(b => ({ id: b.id, name: b.name, code: b.code })));
    } else if (!branchesLoading && branches.length === 0) {
      console.warn('[ProductGallery] ⚠️ No branches loaded! Check API connection and database.');
    }
  }, [branches, branchesLoading]);

  const getBranchLabel = (branch: Branch) => branch.name;

  const [products, setProducts] = useState<ProductWithAvailability[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedLensType, setSelectedLensType] = useState<string>('all');
  const [selectedImageIndices, setSelectedImageIndices] = useState<{[productId: number]: number}>({});
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [zoomState, setZoomState] = useState<{[productId: number]: {isZooming: boolean, x: number, y: number}}>({});

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (productId: number, imageCount: number) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = selectedImageIndices[productId] || 0;
      let newIndex = currentIndex;
      
      if (isLeftSwipe) {
        // Swipe left - next image
        newIndex = currentIndex < imageCount - 1 ? currentIndex + 1 : 0;
      } else if (isRightSwipe) {
        // Swipe right - previous image
        newIndex = currentIndex > 0 ? currentIndex - 1 : imageCount - 1;
      }
      
      setSelectedImageIndices(prev => ({ ...prev, [productId]: newIndex }));
    }
  };

  // Simplified zoom functionality handlers
  const handleMouseEnter = (productId: number) => {
    setZoomState(prev => ({ 
      ...prev, 
      [productId]: { isZooming: true, x: 50, y: 50 } 
    }));
  };

  const handleMouseLeave = (productId: number) => {
    setZoomState(prev => ({ 
      ...prev, 
      [productId]: { isZooming: false, x: 50, y: 50 } 
    }));
  };

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Load products on mount and poll for updates (reduced frequency)
  useEffect(() => {
    fetchProducts(false);
    const intervalId = setInterval(() => {
      // Only auto-refresh if no products have been deleted recently (to prevent reappearing)
      if (!shouldSkipRefresh()) {
        fetchProducts(true);
      }
    }, 30000); // Reduced from 5 seconds to 30 seconds
    
    // Listen for product deletion events to refresh immediately
    const handleProductDeletion = (event: CustomEvent) => {
      console.log('Product deleted, refreshing gallery:', event.detail.productId);
      // Immediately refresh products to reflect deletion
      fetchProducts(true);
    };
    
    window.addEventListener('productDeleted', handleProductDeletion as EventListener);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('productDeleted', handleProductDeletion as EventListener);
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/product-categories`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };


  const fetchProducts = async (silent: boolean = false) => {
    try {
      if (!silent && !hasLoadedOnce) {
        setLoading(true);
        setError(null);
      }
      
      const startTime = Date.now();
      console.log('[ProductGallery] Fetching products...');
      const data = await getProducts(searchQuery);
      const loadTime = Date.now() - startTime;
      
      console.log(`[ProductGallery] Products loaded in ${loadTime}ms`);
      console.log(`[ProductGallery] Received ${data.length} products`);
      console.log(`[ProductGallery] First product:`, data[0] ? { id: data[0].id, name: data[0].name } : 'none');
      setProducts(data);
      console.log(`[ProductGallery] Products state updated with ${data.length} items`);
    } catch (error) {
      console.error('[ProductGallery] Failed to fetch products:', error);
      setError('Failed to load products. Please try again.');
    } finally {
      if (!silent && !hasLoadedOnce) setLoading(false);
      if (!hasLoadedOnce) setHasLoadedOnce(true);
    }
  };

  // Handle search with longer debounce to reduce API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only refresh if no products have been deleted recently (to prevent reappearing)
      if (!shouldSkipRefresh()) {
        fetchProducts(true);
      }
    }, 500); // Increased from 300ms to 500ms
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);


  // Filter products by search query, category, and active status
  const filteredProducts = React.useMemo(() => {
    console.log(`[ProductGallery] Filtering products:`, {
      totalProducts: products.length,
      searchQuery,
      selectedCategory,
      role
    });
    
    // Sort products: favorites first, then by created_at
    const sorted = [...products].sort((a, b) => {
      const aIsFavorite = favorites.includes(a.id);
      const bIsFavorite = favorites.includes(b.id);
      
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      
      // If both have same favorite status, sort by created_at (newest first)
      const aDate = new Date(a.created_at || 0).getTime();
      const bDate = new Date(b.created_at || 0).getTime();
      return bDate - aDate;
    });

    const filtered = sorted.filter(product => {
      // For customers, only show active products (backend should handle this, but double-check on frontend)
      if (role === 'customer' && product.is_active === false) {
        return false;
      }
      
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Category matching: filter by category_id from product management
      const matchesCategory = selectedCategory === 'all' || 
        product.category_id?.toString() === selectedCategory;
      
      const matchesGender = selectedGender === 'all' || 
        !(product as any).gender || 
        (product as any).gender === selectedGender;
      
      const matchesLensType = selectedLensType === 'all' || 
        !(product as any).lens_type || 
        (product as any).lens_type === selectedLensType;

      return matchesSearch && matchesCategory && matchesGender && matchesLensType;
    });
    
    console.log(`[ProductGallery] Filtered products count: ${filtered.length}`);
    return filtered;
  }, [products, searchQuery, selectedCategory, selectedGender, selectedLensType, role, categories, favorites]);

  // Use real branches from API
  const availableBranches: Branch[] = branches;

  const getBranchStockText = (product: ProductWithAvailability, branchCode: string) => {
    if (!product.branch_availability) return 'Not available';
    const branchAvailability = product.branch_availability.find(ba => ba.branch.code === branchCode);
    if (!branchAvailability) return 'Not available';
    if (!branchAvailability.is_available) return 'Out of Stock';
    return `${branchAvailability.available_quantity} pcs`;
  };

  const getBranchStockClass = (product: ProductWithAvailability, branchCode: string) => {
    if (!product.branch_availability) return 'text-gray-500';
    
    const branchAvailability = product.branch_availability.find(
      ba => ba.branch.code === branchCode
    );
    
    if (!branchAvailability || !branchAvailability.is_available) {
      return 'text-red-500 font-semibold';
    }
    
    if (branchAvailability.available_quantity < 5) {
      return 'text-yellow-600 font-semibold';
    }
    
    return 'text-green-600 font-semibold';
  };

  const toggleFavorite = (productId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      let favoritesList: number[] = stored ? JSON.parse(stored) : [];
      
      if (favoritesList.includes(productId)) {
        favoritesList = favoritesList.filter(id => id !== productId);
      } else {
        if (!favoritesList.includes(productId)) {
          favoritesList.push(productId);
        }
      }
      
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesList));
      setFavorites(favoritesList);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };


  const handleManualRefresh = async () => {
    // Clear deletion timestamp to allow refresh
    clearDeletionProtection();
    await fetchProducts(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .cursor-zoom-in {
          cursor: pointer;
        }
        .cursor-zoom-in:hover {
          cursor: zoom-in;
        }
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        @media (max-width: 640px) {
          .product-card {
            min-height: auto;
          }
        }
      `}</style>
      
      {error && (
          <div className="max-w-4xl mx-auto mb-4 sm:mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          </div>
        )}

      {/* Enhanced Search Controls */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg sm:rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
      </div>

      {/* Category Filter - Based on Product Management Categories */}
      {categories.length > 0 && (
        <div className="max-w-7xl mx-auto mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 lg:p-6">
            <div className="flex items-center mb-3 sm:mb-4">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">Browse by Category</h3>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-2.5 md:gap-3">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm md:text-base transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md sm:shadow-lg transform scale-[1.02] sm:scale-105'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <span>All Products</span>
              </button>
              {categories
                .filter(cat => cat.is_active)
                .sort((a, b) => {
                  // Sort by sort_order if available, otherwise by name
                  if (a.sort_order !== undefined && b.sort_order !== undefined) {
                    return (a.sort_order || 0) - (b.sort_order || 0);
                  }
                  return (a.name || '').localeCompare(b.name || '');
                })
                .map((category) => {
                // Count products in this category from current products list
                const productCount = products.filter(p => p.category_id === category.id).length;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id.toString())}
                    className={`inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm md:text-base transition-all duration-200 whitespace-nowrap gap-1.5 sm:gap-2 ${
                      selectedCategory === category.id.toString()
                        ? 'text-white shadow-md sm:shadow-lg transform scale-[1.02] sm:scale-105'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: selectedCategory === category.id.toString() ? (category.color || '#3B82F6') : undefined,
                    }}
                  >
                    {category.icon && <span className="text-sm sm:text-base md:text-lg leading-none">{category.icon}</span>}
                    <span>{category.name}</span>
                    {productCount > 0 && (
                      <span className={`inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold min-w-[1.5rem] sm:min-w-[1.75rem] ${
                        selectedCategory === category.id.toString()
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {productCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Gender and Lens Type Filters */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Gender Filter */}
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 sm:mb-3">Filter by Gender</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGender('all')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedGender === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedGender('men')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedGender === 'men'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Men&apos;s
                </button>
                <button
                  onClick={() => setSelectedGender('women')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedGender === 'women'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Women&apos;s
                </button>
                <button
                  onClick={() => setSelectedGender('kids')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedGender === 'kids'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Kids
                </button>
                <button
                  onClick={() => setSelectedGender('unisex')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedGender === 'unisex'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Unisex
                </button>
              </div>
            </div>

            {/* Lens Type Filter */}
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 sm:mb-3">Filter by Lens Type</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedLensType('all')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'all'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setSelectedLensType('single_vision')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'single_vision'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Single Vision
                </button>
                <button
                  onClick={() => setSelectedLensType('progressive')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'progressive'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Progressive
                </button>
                <button
                  onClick={() => setSelectedLensType('bifocal')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'bifocal'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Bifocal
                </button>
                <button
                  onClick={() => setSelectedLensType('reading')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'reading'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Reading
                </button>
                <button
                  onClick={() => setSelectedLensType('trifocal')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'trifocal'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Trifocal
                </button>
                <button
                  onClick={() => setSelectedLensType('photochromic')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'photochromic'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Photochromic
                </button>
                <button
                  onClick={() => setSelectedLensType('polarized')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'polarized'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Polarized
                </button>
                <button
                  onClick={() => setSelectedLensType('computer')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    selectedLensType === 'computer'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Computer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8 sm:py-12 lg:py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4 sm:mb-6">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-white border-t-transparent"></div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">Loading Products</h3>
              <p className="text-sm sm:text-base text-gray-500">Discovering the perfect eye care solutions for you...</p>
            </div>
          </div>
      )}

      {/* Enhanced Products Grid */}
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6">
          {filteredProducts.map(product => (
            <div 
              key={product.id} 
              onClick={() => navigate(`/customer/products/${product.id}`)}
              className="group bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-sm sm:shadow-md lg:shadow-lg hover:shadow-lg sm:hover:shadow-xl lg:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 active:scale-[0.98] sm:hover:-translate-y-1 cursor-pointer relative"
            >
                {/* Product Image - Simplified */}
                {product.image_paths && product.image_paths.length > 0 ? (
                  <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                    <img
                      src={getStorageUrl((product.image_order || product.image_paths || [])[0])}
                      alt={product.name}
                      className="w-full h-full object-contain transition-transform duration-300 sm:group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = getFallbackImageUrl(product.name, '400x400');
                      }}
                    />
                    {/* Heart Icon - Top Right */}
                    <button
                      onClick={(e) => toggleFavorite(product.id, e)}
                      className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 md:top-2 md:right-2 lg:top-3 lg:right-3 p-1 sm:p-1.5 md:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm sm:shadow-md hover:bg-white active:scale-95 sm:hover:scale-110 transition-all duration-200 z-10 touch-manipulation"
                      aria-label={favorites.includes(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 transition-colors ${
                          favorites.includes(product.id)
                            ? 'text-red-500 fill-current'
                            : 'text-gray-400 sm:hover:text-red-400'
                        }`}
                        fill={favorites.includes(product.id) ? 'currentColor' : 'none'}
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
                ) : (
                  <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {/* Heart Icon - Top Right for no image case */}
                    <button
                      onClick={(e) => toggleFavorite(product.id, e)}
                      className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 md:top-2 md:right-2 lg:top-3 lg:right-3 p-1 sm:p-1.5 md:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm sm:shadow-md hover:bg-white active:scale-95 sm:hover:scale-110 transition-all duration-200 z-10 touch-manipulation"
                      aria-label={favorites.includes(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 transition-colors ${
                          favorites.includes(product.id)
                            ? 'text-red-500 fill-current'
                            : 'text-gray-400 sm:hover:text-red-400'
                        }`}
                        fill={favorites.includes(product.id) ? 'currentColor' : 'none'}
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
                )}

                {/* Product Name and Price */}
                <div className="p-2 sm:p-2.5 md:p-3 lg:p-4">
                  <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-800 mb-1 sm:mb-1.5 md:mb-2 line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] md:min-h-[2.5rem] lg:min-h-[3rem] leading-tight">
                    {product.name}
                  </h3>
                  <div className="text-center mt-1 sm:mt-1.5">
                    <span className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      ₱{Number(product.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8 sm:py-12 lg:py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full mb-4 sm:mb-6">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2 sm:mb-3 px-4">No Products Found</h3>
            <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto px-4">
              {searchQuery 
                ? `We couldn't find any products matching "${searchQuery}". Try adjusting your search terms.`
                : "No products are currently available. Please check back later."
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductGallery;

