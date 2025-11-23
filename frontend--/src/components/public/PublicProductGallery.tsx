import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/features/products/types/product.types';
import { getProducts, getProduct } from '@/services/productApi';
import { useQuery } from '@tanstack/react-query';
import { getActiveBranches, Branch } from '@/services/branchApi';
import { getStorageUrl, getFallbackImageUrl } from '@/utils/imageUtils';
import { RefreshCw, X, ChevronLeft, ChevronRight, ShoppingBag, Heart, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { shouldSkipRefresh, clearDeletionProtection } from '@/utils/deletionProtection';
import { API_BASE_URL } from '@/config/api';
import ReservationModal from '@/features/products/components/ReservationModal';
import { Button } from '@/components/ui/button';
import everbrightBg from '@/assets/everbright-bg.jpg';

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

const PublicProductGallery: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const [products, setProducts] = useState<ProductWithAvailability[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<boolean>(false);
  const [shouldPoll, setShouldPoll] = useState<boolean>(true);
  const shouldPollRef = useRef<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImageIndices, setSelectedImageIndices] = useState<{[productId: number]: number}>({});
  
  // Product detail modal state
  const [selectedProductForGallery, setSelectedProductForGallery] = useState<ProductWithAvailability | null>(null);
  const [galleryImageIndex, setGalleryImageIndex] = useState<number>(0);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [zoomState, setZoomState] = useState<{isZooming: boolean, x: number, y: number}>({isZooming: false, x: 0, y: 0});
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [carouselTouchStart, setCarouselTouchStart] = useState<number | null>(null);
  const [carouselTouchEnd, setCarouselTouchEnd] = useState<number | null>(null);
  const [productsPerPage, setProductsPerPage] = useState<number>(5);

  // Touch handlers for product card images (in gallery grid)
  const minSwipeDistance = 50;

  // Carousel navigation functions will be defined after filteredProducts

  const onTouchStartProductCard = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMoveProductCard = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndProductCard = (productId: number, imageCount: number) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = selectedImageIndices[productId] || 0;
      let newIndex = currentIndex;
      
      if (isLeftSwipe) {
        newIndex = currentIndex < imageCount - 1 ? currentIndex + 1 : 0;
      } else if (isRightSwipe) {
        newIndex = currentIndex > 0 ? currentIndex - 1 : imageCount - 1;
      }
      
      setSelectedImageIndices(prev => ({ ...prev, [productId]: newIndex }));
    }
  };

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Load products on mount and poll for updates
  useEffect(() => {
    let mounted = true;
    
    fetchProducts(false).then(() => {
      // Only enable polling if initial fetch succeeds
      if (mounted) {
        setShouldPoll(true);
        shouldPollRef.current = true;
      }
    }).catch(() => {
      // Disable polling if initial fetch fails
      if (mounted) {
        setShouldPoll(false);
        shouldPollRef.current = false;
      }
    });
    
    const intervalId = setInterval(() => {
      if (shouldPollRef.current && !shouldSkipRefresh()) {
        fetchProducts(true);
      }
    }, 30000);
    
    const handleProductDeletion = (event: CustomEvent) => {
      console.log('Product deleted, refreshing gallery:', event.detail.productId);
      fetchProducts(true);
    };
    
    window.addEventListener('productDeleted', handleProductDeletion as EventListener);
    
    return () => {
      mounted = false;
      clearInterval(intervalId);
      window.removeEventListener('productDeleted', handleProductDeletion as EventListener);
    };
  }, []); // Only run on mount

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
        setLoadingTimeout(false);
      }
      
      // Fetch all products (don't filter by active status for front page)
      // Pass show_all=true to bypass active status filter for public gallery
      const data = await getProducts('', undefined, undefined, true);
      setProducts(data);
      // Reset carousel to first page when products are loaded
      setCarouselIndex(0);
      // Ensure 'all' category is selected to show all products
      setSelectedCategory('all');
      setLoadingTimeout(false);
      // Re-enable polling on successful fetch
      setShouldPoll(true);
      shouldPollRef.current = true;
    } catch (error: any) {
      console.error('[ProductGallery] Failed to fetch products:', error);
      setLoadingTimeout(false);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load products.';
      let suggestion = '';
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Request timed out.';
        suggestion = 'The server may be slow or unavailable. Please check if the backend server is running and try again.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred.';
        suggestion = 'Please check if the database is running and the backend server is properly configured.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Products endpoint not found.';
        suggestion = 'The API endpoint may have changed. Please contact support.';
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server.';
        suggestion = 'Please check if the backend server is running on ' + API_BASE_URL + ' and try again.';
      } else {
        suggestion = 'Please try again later or contact support if the problem persists.';
      }
      
      setError(`${errorMessage} ${suggestion}`);
    } finally {
      if (!silent && !hasLoadedOnce) setLoading(false);
      if (!hasLoadedOnce) setHasLoadedOnce(true);
    }
  };

  // Show timeout warning after 5 seconds of loading
  useEffect(() => {
    if (loading && !hasLoadedOnce) {
      const timeoutId = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000);
      
      return () => clearTimeout(timeoutId);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading, hasLoadedOnce]);

  // Filter products by search query and category
  const filteredProducts = React.useMemo(() => {
    // For front page, show all products (don't filter by is_active)
    // Sort by ID ascending to show products 1-4 first
    const sorted = [...products].sort((a, b) => {
      const aIsFavorite = favorites.includes(a.id);
      const bIsFavorite = favorites.includes(b.id);
      
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      
      // Sort by ID ascending (older products first, so 1-4 appear first)
      return (a.id || 0) - (b.id || 0);
    });

    const filtered = sorted.filter(product => {
      // Don't filter by is_active for front page - show all products
      // if (product.is_active === false) {
      //   return false;
      // }
      
      // Show all products when 'all' is selected, otherwise filter by category
      if (selectedCategory === 'all') {
        return true; // Show all products regardless of category
      }
      
      // Filter by selected category
      return product.category_id?.toString() === selectedCategory;
    });
    
    return filtered;
  }, [products, selectedCategory, favorites]);

  // Responsive products per page based on screen size
  useEffect(() => {
    const getProductsPerPage = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        if (width < 640) return 1; // Mobile
        if (width < 768) return 2; // Small tablet
        if (width < 1024) return 3; // Tablet
        if (width < 1280) return 4; // Desktop
        return 5; // Large desktop
      }
      return 5; // Default
    };
    
    setProductsPerPage(getProductsPerPage());
    
    const handleResize = () => {
      setProductsPerPage(getProductsPerPage());
      setCarouselIndex(0); // Reset to first page on resize
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carousel navigation functions (defined after filteredProducts)
  const nextCarousel = useCallback(() => {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    const maxCarouselIndex = Math.max(0, totalPages - 1);
    setCarouselIndex((prev) => Math.min(prev + 1, maxCarouselIndex));
  }, [filteredProducts.length, productsPerPage]);

  const prevCarousel = useCallback(() => {
    setCarouselIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFavorite = (productId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  const handleProductClick = (e: React.MouseEvent, product: ProductWithAvailability) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Open modal immediately with current product data
    setSelectedProductForGallery(product);
    setGalleryImageIndex(0);
    setIsGalleryModalOpen(true);
    
    // Only fetch full product details if user is logged in (for branch availability)
    // For public users, use the product data we already have to avoid 401 redirects
    if (user) {
      // Use setTimeout to ensure modal state is set first
      setTimeout(() => {
        getProduct(product.id)
          .then((fullProduct) => {
            setSelectedProductForGallery(fullProduct);
          })
          .catch((error) => {
            console.error('Error fetching product details:', error);
            // Keep using the product we already have - modal stays open
          });
      }, 100);
    }
  };

  const handleImageClick = (e: React.MouseEvent, product: ProductWithAvailability) => {
    e.stopPropagation(); // Prevent card click
    handleProductClick(e, product);
  };

  const handleReserveFromGallery = () => {
    if (!user) {
      setIsGalleryModalOpen(false);
      navigate('/login', { 
        state: { 
          from: '/', 
          action: 'reserve', 
          productId: selectedProductForGallery?.id 
        } 
      });
      return;
    }
    
    // Open reservation modal
    setIsGalleryModalOpen(false);
    setIsReservationModalOpen(true);
  };

  const availableBranches = selectedProductForGallery?.branch_availability?.filter(ba => 
    ba.is_available && 
    ba.branch && 
    ba.branch.id && 
    ba.branch.name
  ) || [];

  const getMaxQuantity = () => {
    if (!selectedBranch || !selectedProductForGallery) return 1;
    const branchAvailability = selectedProductForGallery.branch_availability?.find(
      ba => ba.branch && ba.branch.id === selectedBranch
    );
    return branchAvailability?.available_quantity || 1;
  };

  // Reset selected branch when product changes
  useEffect(() => {
    if (selectedProductForGallery && selectedProductForGallery.branch_availability) {
      const branches = selectedProductForGallery.branch_availability.filter(ba => 
        ba.is_available && 
        ba.branch && 
        ba.branch.id && 
        ba.branch.name
      );
      
      if (branches.length > 0) {
        const firstAvailable = branches[0];
        if (firstAvailable?.branch?.id) {
          setSelectedBranch(firstAvailable.branch.id);
        }
      } else {
        setSelectedBranch(null);
      }
    } else {
      setSelectedBranch(null);
    }
  }, [selectedProductForGallery]);

  const nextImage = useCallback(() => {
    if (!selectedProductForGallery || isTransitioning) return;
    const images = selectedProductForGallery.image_order || selectedProductForGallery.image_paths || [];
    setIsTransitioning(true);
    setGalleryImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setTimeout(() => setIsTransitioning(false), 300);
  }, [selectedProductForGallery, isTransitioning]);

  const prevImage = useCallback(() => {
    if (!selectedProductForGallery || isTransitioning) return;
    const images = selectedProductForGallery.image_order || selectedProductForGallery.image_paths || [];
    setIsTransitioning(true);
    setGalleryImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setTimeout(() => setIsTransitioning(false), 300);
  }, [selectedProductForGallery, isTransitioning]);

  // Touch handlers for carousel modal swipe gestures
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextImage();
    } else if (isRightSwipe) {
      prevImage();
    }
  };

  useEffect(() => {
    if (!isGalleryModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'Escape') {
        setIsGalleryModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryModalOpen, prevImage, nextImage]);

  const handleManualRefresh = async () => {
    clearDeletionProtection();
    await fetchProducts(false);
  };

  return (
    <section 
      id="product-gallery-section" 
      className="relative py-8 sm:py-12"
      style={{
        backgroundImage: `url(${everbrightBg})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-sm"></div>
      
      <div className="relative z-10 min-h-screen px-4 sm:px-6 lg:px-8 py-2 sm:py-4">
        <style>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .touch-manipulation {
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
          }
        `}</style>
        
        {error && (
          <div className="max-w-4xl mx-auto mb-4 sm:mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-sm">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="mb-2">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      fetchProducts(false);
                    }}
                    className="text-red-800 underline hover:text-red-900 font-medium text-sm"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="max-w-7xl mx-auto mb-4 sm:mb-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 sm:mb-3">
            Our Product Gallery
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-2 sm:mb-3">
            Browse our collection of premium eyewear and optical products.
          </p>
          {!user && (
            <p className="text-sm text-slate-500">
              <span className="text-primary font-medium">Sign in</span> or <span className="text-primary font-medium">sign up</span> to reserve products for pickup at your preferred branch.
            </p>
          )}
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="max-w-7xl mx-auto mb-4 sm:mb-6 lg:mb-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 lg:p-6">
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
                    if (a.sort_order !== undefined && b.sort_order !== undefined) {
                      return (a.sort_order || 0) - (b.sort_order || 0);
                    }
                    return (a.name || '').localeCompare(b.name || '');
                  })
                  .map((category) => {
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

        {loading && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8 sm:py-12 lg:py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4 sm:mb-6">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-white border-t-transparent"></div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">Loading Products</h3>
              <p className="text-sm sm:text-base text-gray-500 mb-4">Discovering the perfect eye care solutions for you...</p>
              
              {loadingTimeout && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                  <p className="mb-2">Taking longer than expected...</p>
                  <button
                    onClick={() => fetchProducts(false)}
                    className="text-yellow-800 underline hover:text-yellow-900 font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products Carousel */}
        {filteredProducts.length > 0 && (() => {
          const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
          const maxCarouselIndex = Math.max(0, totalPages - 1);

          return (
            <div className="w-full relative px-2 sm:px-4 md:px-6 lg:px-8">
              {/* Carousel Container */}
              <div 
                className="overflow-hidden relative"
                onTouchStart={(e) => {
                  setCarouselTouchEnd(null);
                  setCarouselTouchStart(e.targetTouches[0].clientX);
                }}
                onTouchMove={(e) => {
                  setCarouselTouchEnd(e.targetTouches[0].clientX);
                }}
                onTouchEnd={() => {
                  if (!carouselTouchStart || !carouselTouchEnd) return;
                  const distance = carouselTouchStart - carouselTouchEnd;
                  const isLeftSwipe = distance > minSwipeDistance;
                  const isRightSwipe = distance < -minSwipeDistance;

                  if (isLeftSwipe) {
                    nextCarousel();
                  } else if (isRightSwipe) {
                    prevCarousel();
                  }
                }}
              >
                <div 
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{
                    transform: `translateX(-${carouselIndex * (100 / productsPerPage)}%)`
                  }}
                >
                {filteredProducts.map(product => (
              <div 
                key={product.id}
                className="flex-shrink-0"
                style={{ 
                  width: `${100 / productsPerPage}%`,
                  paddingLeft: '0.5rem',
                  paddingRight: '0.5rem'
                }}
              >
                <div 
                  onClick={(e) => handleProductClick(e, product)}
                  className="group bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-sm sm:shadow-md lg:shadow-lg hover:shadow-lg sm:hover:shadow-xl lg:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 active:scale-[0.98] sm:hover:-translate-y-1 cursor-pointer relative h-full"
                >
                {/* Product Image - Clickable for Gallery */}
                {product.image_paths && product.image_paths.length > 0 ? (
                  <div 
                    className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer"
                    onTouchStart={onTouchStartProductCard}
                    onTouchMove={onTouchMoveProductCard}
                    onTouchEnd={() => onTouchEndProductCard(product.id, product.image_paths?.length || 0)}
                    onClick={(e) => handleImageClick(e, product)}
                  >
                    <img
                      src={getStorageUrl((product.image_order || product.image_paths || [])[selectedImageIndices[product.id] || 0])}
                      alt={product.name}
                      className="w-full h-full object-contain transition-transform duration-300 sm:group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = getFallbackImageUrl(product.name, '400x400');
                      }}
                    />
                    {/* Image Gallery Indicator */}
                    {(product.image_paths?.length || 0) > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                        {(product.image_paths?.length || 0)} photos
                      </div>
                    )}
                    {/* Heart Icon */}
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
              </div>
                ))}
              </div>
            </div>

            {/* Carousel Navigation Arrows */}
            {filteredProducts.length > productsPerPage && (
              <>
                <button
                  onClick={prevCarousel}
                  disabled={carouselIndex === 0}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 sm:p-3 shadow-xl transition-all duration-200 z-10 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous products"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>
                
                <button
                  onClick={nextCarousel}
                  disabled={carouselIndex >= maxCarouselIndex}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 sm:p-3 shadow-xl transition-all duration-200 z-10 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next products"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>
              </>
            )}

            {/* Carousel Indicators */}
            {filteredProducts.length > productsPerPage && (
              <div className="flex justify-center gap-2 mt-4 sm:mt-6">
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCarouselIndex(index)}
                    className={`transition-all duration-300 rounded-full ${
                      index === carouselIndex
                        ? 'w-8 h-2 bg-blue-600'
                        : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Go to page ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
          );
        })()}

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
                No products are currently available. Please check back later.
              </p>
            </div>
          </div>
        )}

        {/* Product Detail Modal */}
        {isGalleryModalOpen && selectedProductForGallery && (() => {
          const images = selectedProductForGallery.image_order || selectedProductForGallery.image_paths || [];
          const currentImage = images[galleryImageIndex];
          const isProductFavorite = favorites.includes(selectedProductForGallery.id);
          
          return (
            <div 
              className="fixed inset-0 bg-black/90 z-50 overflow-y-auto"
              onClick={() => setIsGalleryModalOpen(false)}
            >
              <div 
                className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-w-7xl mx-auto">
                  {/* Close Button */}
                  <button
                    onClick={() => setIsGalleryModalOpen(false)}
                    className="absolute top-4 right-4 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  {/* Main Content - Two Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    {/* Left Side - Images Carousel */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                      {/* Carousel Container */}
                      <div 
                        className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 cursor-zoom-in group overflow-hidden"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
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
                      >
                        {/* Carousel Images Container */}
                        <div 
                          className="flex h-full transition-transform duration-500 ease-in-out"
                          style={{
                            transform: `translateX(-${galleryImageIndex * 100}%)`
                          }}
                        >
                          {images.length > 0 ? (
                            images.map((imagePath, index) => (
                              <div
                                key={index}
                                className="min-w-full h-full flex items-center justify-center relative"
                              >
                                <img
                                  src={getStorageUrl(imagePath)}
                                  alt={`${selectedProductForGallery.name} ${index + 1}`}
                                  className={`w-full h-full object-contain transition-transform duration-300 ${
                                    zoomState.isZooming && index === galleryImageIndex ? 'scale-150' : 'scale-100'
                                  }`}
                                  style={{
                                    transformOrigin: index === galleryImageIndex ? `${zoomState.x}% ${zoomState.y}%` : 'center center'
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.src = getFallbackImageUrl(selectedProductForGallery.name, '800x800');
                                  }}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="min-w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Navigation Arrows */}
                        {images.length > 1 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                prevImage();
                              }}
                              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-xl transition-all duration-200 z-10 hover:scale-110 active:scale-95"
                              aria-label="Previous image"
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                nextImage();
                              }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-xl transition-all duration-200 z-10 hover:scale-110 active:scale-95"
                              aria-label="Next image"
                            >
                              <ChevronRight className="w-6 h-6" />
                            </button>
                          </>
                        )}

                        {/* Carousel Indicators (Dots) */}
                        {images.length > 1 && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                            {images.map((_, index) => (
                              <button
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsTransitioning(true);
                                  setGalleryImageIndex(index);
                                  setTimeout(() => setIsTransitioning(false), 300);
                                }}
                                className={`transition-all duration-300 rounded-full ${
                                  index === galleryImageIndex
                                    ? 'w-8 h-2 bg-blue-600'
                                    : 'w-2 h-2 bg-white/60 hover:bg-white/80'
                                }`}
                                aria-label={`Go to image ${index + 1}`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Image Counter */}
                        {images.length > 1 && (
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-md z-10">
                            {galleryImageIndex + 1} / {images.length}
                          </div>
                        )}

                        {/* Zoom Indicator */}
                        {!zoomState.isZooming && images.length > 0 && (
                          <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm text-gray-700 text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center space-x-2 shadow-sm pointer-events-none z-10">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span>Hover to zoom</span>
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
                                onClick={() => setGalleryImageIndex(index)}
                                className={`flex-shrink-0 relative transition-all duration-200 ${
                                  index === galleryImageIndex ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-300'
                                }`}
                              >
                                <img
                                  src={getStorageUrl(imagePath)}
                                  alt={`Thumbnail ${index + 1}`}
                                  className={`w-20 h-20 object-cover rounded-lg border-2 ${
                                    index === galleryImageIndex ? 'border-blue-500' : 'border-gray-200'
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

                    {/* Right Side - Product Info */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8">
                      {/* Product Basic Info */}
                      <div className="mb-6">
                        <div className="flex items-start justify-between mb-2">
                          <h1 className="text-3xl font-bold text-gray-900 flex-1">{selectedProductForGallery.name}</h1>
                          <button
                            onClick={(e) => toggleFavorite(selectedProductForGallery.id, e)}
                            className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label={isProductFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart
                              className={`w-6 h-6 transition-colors ${
                                isProductFavorite
                                  ? 'text-red-500 fill-current'
                                  : 'text-gray-400 hover:text-red-400'
                              }`}
                              fill={isProductFavorite ? 'currentColor' : 'none'}
                            />
                          </button>
                        </div>
                        {selectedProductForGallery.description && (
                          <p className="text-gray-600 mb-4">{selectedProductForGallery.description}</p>
                        )}
                        <div className="flex items-baseline mb-6">
                          <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            ₱{Number(selectedProductForGallery.price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Branch Availability Check */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-5 h-5" />
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
                          const branchAvailability = selectedProductForGallery.branch_availability?.find(
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

                      {/* Reserve Section */}
                      {!user ? (
                        <div className="border-t pt-6">
                          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 text-center border border-blue-200">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Sign In to Reserve</h3>
                            <p className="text-gray-600 mb-4">
                              Create an account or sign in to reserve this product for pickup at your preferred branch.
                            </p>
                            <div className="flex gap-3 justify-center">
                              <Button
                                onClick={() => {
                                  setIsGalleryModalOpen(false);
                                  navigate('/register');
                                }}
                                variant="outline"
                                size="lg"
                              >
                                Sign Up
                              </Button>
                              <Button
                                onClick={handleReserveFromGallery}
                                size="lg"
                                className="flex items-center gap-2"
                              >
                                Sign In
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t pt-6">
                          <Button
                            onClick={handleReserveFromGallery}
                            size="lg"
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                          >
                            <ShoppingBag className="w-5 h-5" />
                            Reserve Now
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Reservation Modal */}
        {selectedProductForGallery && (
          <ReservationModal
            product={selectedProductForGallery as any}
            isOpen={isReservationModalOpen}
            onClose={() => {
              setIsReservationModalOpen(false);
              setSelectedProductForGallery(null);
            }}
            onReservationSuccess={() => {
              setIsReservationModalOpen(false);
              setSelectedProductForGallery(null);
            }}
          />
        )}
      </div>
    </section>
  );
};

export default PublicProductGallery;
