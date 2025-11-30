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
import { Label } from '@/components/ui/label';

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
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedShape, setSelectedShape] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedFrameMaterial, setSelectedFrameMaterial] = useState<string>('all');
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
        const categoriesList = data.categories || data.data || [];
        console.log('[ProductGallery] Categories loaded:', categoriesList.map((c: Category) => ({ id: c.id, name: c.name, slug: c.slug })));
        setCategories(categoriesList);
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
      
      // Convert selectedCategory to number if it's not 'all'
      const categoryId = selectedCategory !== 'all' && selectedCategory !== '' 
        ? parseInt(selectedCategory, 10) 
        : undefined;
      
      // Find the category name for debugging
      const selectedCategoryName = categoryId 
        ? categories.find(c => c.id === categoryId)?.name || 'Unknown'
        : 'All';
      
      console.log('[ProductGallery] Fetching products with filters:', {
        search: searchQuery,
        selectedCategory: selectedCategory,
        categoryId: categoryId,
        categoryName: selectedCategoryName,
        gender: selectedGender,
        brandOrType: selectedBrand
      });
      
      // Send brand filter (including special __branded__ and __non_branded__ values)
      const brandFilter = selectedBrand !== 'all' ? selectedBrand : undefined;
      
      const data = await getProducts(
        searchQuery,
        categoryId,
        undefined, // isActive - let backend handle based on role
        undefined, // showAll
        selectedGender !== 'all' ? selectedGender : undefined,
        undefined, // lensType - not currently used in this component
        brandFilter
      );
      const loadTime = Date.now() - startTime;
      
      console.log(`[ProductGallery] Products loaded in ${loadTime}ms`);
      console.log(`[ProductGallery] Received ${data.length} products`);
      console.log(`[ProductGallery] First product:`, data[0] ? { id: data[0].id, name: data[0].name, brand: data[0].brand, category_id: data[0].category_id } : 'none');
      
      // Verify category filtering - check if products match the selected category
      if (categoryId !== undefined && data.length > 0) {
        const mismatchedProducts = data.filter(p => p.category_id !== categoryId);
        if (mismatchedProducts.length > 0) {
          console.warn(`[ProductGallery] ⚠️ WARNING: Found ${mismatchedProducts.length} products with mismatched category_id!`, {
            expectedCategoryId: categoryId,
            expectedCategoryName: selectedCategoryName,
            mismatchedProducts: mismatchedProducts.slice(0, 5).map(p => ({ 
              id: p.id, 
              name: p.name, 
              category_id: p.category_id 
            }))
          });
        } else {
          console.log(`[ProductGallery] ✅ All products match category_id ${categoryId} (${selectedCategoryName})`);
        }
      }
      
      // Debug: Log brand values from received products
      if (selectedBrand !== 'all' && selectedBrand !== '__branded__' && selectedBrand !== '__non_branded__') {
        const brandsInResults = [...new Set(data.map(p => p.brand).filter(b => b))];
        console.log(`[ProductGallery] Brand filter: "${selectedBrand}"`);
        console.log(`[ProductGallery] Brands in results:`, brandsInResults);
        console.log(`[ProductGallery] Products with matching brand:`, data.filter(p => 
          p.brand && p.brand.toLowerCase().trim() === selectedBrand.toLowerCase().trim()
        ).length);
      }
      
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

  // Handle search and filter changes with debounce to reduce API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only refresh if no products have been deleted recently (to prevent reappearing)
      if (!shouldSkipRefresh()) {
        fetchProducts(true);
      }
    }, 500); // Increased from 300ms to 500ms
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory, selectedGender, selectedBrand]);


  // Filter products by search query, category, and active status
  const filteredProducts = React.useMemo(() => {
    console.log(`[ProductGallery] Filtering products:`, {
      totalProducts: products.length,
      searchQuery,
      selectedCategory,
      selectedBrand,
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
      
      // Note: Search, category, and gender are now filtered by the backend
      // We only do client-side filtering for filters that backend doesn't support
      
      // Helper function to normalize values for comparison
      const normalize = (value: any): string => {
        if (value === null || value === undefined) return '';
        return value.toString().trim().toLowerCase();
      };
      
      // Helper function to check if value matches in field, name, or description
      const matchesInFieldOrDescription = (
        fieldValue: any,
        filterValue: string,
        productName: string = '',
        description: string = '',
      ): boolean => {
        if (filterValue === 'all') return true;
        const normalizedFilter = normalize(filterValue);
        const normalizedField = normalize(fieldValue);
        const normalizedName = normalize(productName);
        const normalizedDescription = normalize(description);

        // Remove spaces and special characters for better matching (handles "RAY BAN" vs "Ray-Ban")
        const normalizeForMatching = (str: string): string => {
          return str.replace(/[\s\-_]+/g, '').toLowerCase();
        };

        const filterNormalized = normalizeForMatching(normalizedFilter);

        // Check field value (exact and contains)
        if (normalizedField) {
          if (normalizedField === normalizedFilter) return true;
          if (normalizeForMatching(normalizedField) === filterNormalized) return true;
          if (normalizeForMatching(normalizedField).includes(filterNormalized)) return true;
        }

        // Check product name
        if (normalizedName) {
          if (normalizedName.includes(normalizedFilter)) return true;
          if (normalizeForMatching(normalizedName).includes(filterNormalized)) return true;
        }

        // Check description
        if (normalizedDescription) {
          if (normalizedDescription.includes(normalizedFilter)) return true;
          if (normalizeForMatching(normalizedDescription).includes(filterNormalized)) return true;
        }

        return false;
      };

      const matchesColor = selectedColor === 'all'
        ? true
        : matchesInFieldOrDescription(
            (product as any).color,
            selectedColor,
            product.name || '',
            product.description || '',
          );

      // Brand filtering is handled by the backend; client-side only handles Branded / Non-Branded as a safety net.
      let matchesBrandFilter = true;
      if (selectedBrand !== 'all') {
        if (selectedBrand === '__non_branded__') {
          const hasNoBrandField = !product.brand || product.brand.trim() === '';

          // Fallback using image filename for sunglasses category
          let isNonBrandedByFilename = false;
          if (product.category_details?.slug?.toLowerCase() === 'sunglasses') {
            const imagePaths: string[] =
              ((product as any).image_paths as string[]) || [];
            const allPaths = Array.isArray(imagePaths) ? imagePaths : [];
            isNonBrandedByFilename = allPaths.some((p) =>
              p.toLowerCase().includes('nonbranded'),
            );
          }

          matchesBrandFilter = hasNoBrandField || isNonBrandedByFilename;
        } else if (selectedBrand === '__branded__') {
          const hasBrandField = product.brand && product.brand.trim() !== '';
          matchesBrandFilter = !!hasBrandField;
        }
      }

      const matchesShape = matchesInFieldOrDescription(
        (product as any).shape,
        selectedShape,
        product.name || '',
        product.description || '',
      );

      const productSize = (product as any).size || (product as any).frame_size;
      const matchesSize = matchesInFieldOrDescription(
        productSize,
        selectedSize,
        product.name || '',
        product.description || '',
      );

      const matchesFrameMaterial = matchesInFieldOrDescription(
        (product as any).frame_material,
        selectedFrameMaterial,
        product.name || '',
        product.description || '',
      );

      // Only filter by client-side filters (backend handles search, category, gender, and specific brand)
      const result =
        matchesColor && matchesBrandFilter && matchesShape && matchesSize && matchesFrameMaterial;
      
      // Debug logging for brand filter issues
      if (selectedBrand !== 'all' && selectedBrand !== '__branded__' && selectedBrand !== '__non_branded__' && !result) {
        console.log(`[ProductGallery] Product filtered out:`, {
          id: product.id,
          name: product.name,
          brand: product.brand,
          selectedBrand,
          matchesColor,
          matchesShape,
          matchesSize,
          matchesFrameMaterial
        });
      }
      
      return result;
    });
    
    console.log(`[ProductGallery] Filtered products count: ${filtered.length} (from ${products.length} total)`);
    if (selectedBrand !== 'all' && selectedBrand !== '__branded__' && selectedBrand !== '__non_branded__') {
      console.log(`[ProductGallery] Brand filter active: "${selectedBrand}"`);
      console.log(`[ProductGallery] Products with brand in results:`, filtered.filter(p => p.brand).map(p => p.brand));
    }
    return filtered;
  }, [products, selectedColor, selectedShape, selectedSize, selectedFrameMaterial, role, favorites]);

  // Comprehensive list of all available colors
  const allColors = [
    'Black',
    'White',
    'Red',
    'Blue',
    'Green',
    'Yellow',
    'Purple',
    'Pink',
    'Orange',
    'Brown',
    'Gray',
    'Grey',
    'Silver',
    'Gold',
    'Navy',
    'Beige',
    'Tan',
    'Clear',
    'Rose Gold',
    'Multicolor',
    'Transparent',
  ];

  // Comprehensive list of all available shapes
  const allShapes = [
    'Rectangle',
    'Square',
    'Round',
    'Cat Eye',
    'Aviator',
    'Geometric',
    'Oval',
    'Browline',
    'Wayfarer',
    'Clubmaster',
    'Butterfly',
    'Oversized',
  ];

  // Comprehensive list of all available frame materials
  const allFrameMaterials = [
    'Plastic',
    'Acetate',
    'Metal',
    'Titanium',
    'Stainless Steel',
    'Aluminum',
    'TR-90',
    'Carbon Fiber',
    'Wood',
    'Horn',
    'Mixed Materials',
  ];

  // Extract unique colors from products and combine with all colors
  const availableColors = React.useMemo(() => {
    const productColors = new Set<string>();
    products.forEach(product => {
      if ((product as any).color && (product as any).color.trim() !== '') {
        productColors.add((product as any).color.trim());
      }
    });
    
    const allAvailableColors = new Set<string>([
      ...allColors.map(c => c.toLowerCase()),
      ...Array.from(productColors).map(c => c.toLowerCase())
    ]);
    
    const sortedColors = Array.from(allAvailableColors).sort();
    
    return sortedColors.map(color => {
      const productColor = Array.from(productColors).find(pc => pc.toLowerCase() === color);
      if (productColor) {
        return productColor;
      }
      return color.charAt(0).toUpperCase() + color.slice(1);
    });
  }, [products]);

  // Comprehensive list of popular optical brands
  const allBrands = [
    // Eyeglass Frames Brands
    'Ray-Ban',
    'Oakley',
    'Warby Parker',
    'Persol',
    'Tom Ford',
    'Gucci',
    'Prada',
    'Versace',
    'Dior',
    'Chanel',
    'Burberry',
    'Armani',
    'Dolce & Gabbana',
    'Fendi',
    'Bottega Veneta',
    'Maui Jim',
    'Costa Del Mar',
    'Serengeti',
    'Randolph Engineering',
    'Oliver Peoples',
    'Cutler and Gross',
    'Lindberg',
    'Silhouette',
    'Mykita',
    'ic! berlin',
    'Matsuda',
    'Dita',
    'Barton Perreira',
    'Jacques Marie Mage',
    'Lunor',
    'Salt Optics',
    'Moscot',
    'Shuron',
    'American Optical',
    'Retrosuperfuture',
    'Garrett Leight',
    'Theo',
    'Face a Face',
    'Alain Mikli',
    'Lafont',
    'Prodesign Denmark',
    'Etnia Barcelona',
    'Police',
    'Carrera',
    'Vogue',
    'Hugo Boss',
    'Calvin Klein',
    'Ralph Lauren',
    'Tommy Hilfiger',
    'Michael Kors',
    'Kate Spade',
    'Coach',
    'Tory Burch',
    'Marc Jacobs',
    'Diesel',
    'Emporio Armani',
    'Guess',
    'Fossil',
    'Ray-Ban Junior',
    'Oakley Youth',
    // Contact Lens Brands
    'Acuvue',
    'Air Optix',
    'Biofinity',
    'Dailies',
    'Proclear',
    'Biotrue',
    'SofLens',
    'FreshLook',
    'Focus',
    'PureVision',
    'Oasys',
    'Clariti',
    'MyDay',
    'Avaira',
    'Ultra',
    '1-Day Acuvue',
    'Acuvue Oasys',
    'Acuvue Vita',
    'Air Optix Aqua',
    'Biofinity Energys',
    'Dailies AquaComfort Plus',
    'Proclear Multifocal',
    'Biotrue ONEday',
    'SofLens Daily Disposable',
    'FreshLook ColorBlends',
    'Focus Dailies',
    'PureVision 2 HD',
    'Oasys for Astigmatism',
    'Clariti 1 Day',
    'MyDay Daily Disposable',
    'Avaira Vitality',
    'Ultra for Presbyopia',
    // Sunglasses Brands
    'Ray-Ban',
    'Oakley',
    'Maui Jim',
    'Costa Del Mar',
    'Persol',
    'Serengeti',
    'Randolph Engineering',
    'Bolle',
    'Smith',
    'Julbo',
    'Spy Optic',
    'Electric',
    'Von Zipper',
    'Dragon',
    'Native',
    'Revo',
    'Kaenon',
    'Maui Jim',
    'Costa Del Mar',
    'Serengeti',
    'Vuarnet',
    'Polaroid',
    'Quay Australia',
    'Le Specs',
    'Privé Revaux',
    'Blenders',
    'Shady Rays',
    'Sunski',
    'Goodr',
    'Knockaround',
    // Eye Care Products Brands
    'Bausch + Lomb',
    'Alcon',
    'Allergan',
    'Systane',
    'Refresh',
    'TheraTears',
    'Blink',
    'Optive',
    'Genteal',
    'Tears Naturale',
    'Celluvisc',
    'Lacri-Lube',
    'Refresh Optive',
    'Systane Ultra',
    'TheraTears Dry Eye Therapy',
    'Blink Contacts',
    'Optive Advanced',
    'Genteal Tears',
    'Tears Naturale Forte',
    'Celluvisc Lubricant',
    'Lacri-Lube S.O.P.',
    'Rohto',
    'Visine',
    'Clear Eyes',
    'Murine',
    'Zaditor',
    'Alaway',
    'Pataday',
    'Lastacaft',
    'Bepreve',
    'Patanol',
    'Optivar',
    'Livostin',
    'Azelastine',
    'Ketotifen',
    'Olopatadine',
    'Emedastine',
    'Epinastine',
  ];

  // Brand names from the Branded folder structure
  const brandedFrameBrands = [
    'AARALASE',
    'ADIDAS',
    'BLOSSOM',
    'BUBLES',
    'CHANEL',
    'FANTASY',
    'FIVE START',
    'GUYS LAROCHE',
    'JTLF UREN',
    'KATE SPADE',
    'MICHAEL KORS',
    'MOONLIGH',
    'MUSK EYEWEAR',
    'NIKE',
    'OSCARLIAN',
    'RUDY PROJECT',
    'SAINT LAURENT',
    'SOOPER EYEWEAR',
    'SPARK',
    'STAR EYEWEAR',
    'START LIGHT EYEWEAR',
    'SUN',
    'SUNCARI',
    'Suryeoan',
    'XYQ CRAFTSMAN',
    'YAMEI',
  ];

  // Get available brands from products (for dynamic brands not in the list)
  // Normalize brands to handle case variations
  const availableBrandsFromProducts = React.useMemo(() => {
    const productBrands = new Map<string, string>(); // Map<normalized, original>
    products.forEach(product => {
      if (product.brand && product.brand.trim() !== '') {
        const normalized = product.brand.trim().toLowerCase();
        const original = product.brand.trim();
        // Keep the first occurrence of each normalized brand (preserve original casing)
        if (!productBrands.has(normalized)) {
          productBrands.set(normalized, original);
        }
      }
    });
    return Array.from(productBrands.values());
  }, [products]);

  // Combine static branded-frame brands with product brands, removing duplicates.
  // IMPORTANT: Static folder brands are only added for the Frames / All categories
  // so that SUNGLASSES / SOLUTION / CONTACT LENSES don't show frame-only brands.
  const allAvailableBrands = React.useMemo(() => {
    // Create a map of normalized -> original brand names
    const brandMap = new Map<string, string>();

    // First, add product brands (these are the actual values from database)
    availableBrandsFromProducts.forEach((brand) => {
      const normalized = brand.toLowerCase();
      if (!brandMap.has(normalized)) {
        brandMap.set(normalized, brand);
      }
    });

    // Work out current category slug to decide if we should add frame folder brands
    const selectedCategorySlug =
      selectedCategory !== 'all'
        ? categories.find((c) => c.id.toString() === selectedCategory)?.slug?.toLowerCase() || ''
        : 'all';

    const isFramesCategory =
      selectedCategorySlug === 'frames' ||
      selectedCategorySlug === 'eyeglass-frames' ||
      selectedCategorySlug === '' || // initial state before categories load
      selectedCategorySlug === 'all';

    // Only merge in static frame brands when we're looking at Frames / All
    if (isFramesCategory) {
      brandedFrameBrands.forEach((brand) => {
        const normalized = brand.toLowerCase();
        if (!brandMap.has(normalized)) {
          brandMap.set(normalized, brand);
        }
      });
    }

    // Sort by normalized name, but return original casing
    const sorted = Array.from(brandMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return sorted.map(([normalized, original]) => original);
  }, [availableBrandsFromProducts, selectedCategory, categories]);

  // Get lens types from products (for when showing all or lens type filtering)
  const availableLensTypes = React.useMemo(() => {
    const productLensTypes = new Set<string>();
    products.forEach(product => {
      if ((product as any).lens_type && (product as any).lens_type.trim() !== '') {
        productLensTypes.add((product as any).lens_type.trim());
      }
    });
    return Array.from(productLensTypes).sort();
  }, [products]);

  // Extract unique shapes from products and combine with all shapes
  const availableShapes = React.useMemo(() => {
    const productShapes = new Set<string>();
    products.forEach(product => {
      if ((product as any).shape && (product as any).shape.trim() !== '') {
        productShapes.add((product as any).shape.trim());
      }
    });
    
    const allAvailableShapes = new Set<string>([
      ...allShapes.map(s => s.toLowerCase()),
      ...Array.from(productShapes).map(s => s.toLowerCase())
    ]);
    
    const sortedShapes = Array.from(allAvailableShapes).sort();
    
    return sortedShapes.map(shape => {
      const productShape = Array.from(productShapes).find(ps => ps.toLowerCase() === shape);
      if (productShape) {
        return productShape;
      }
      return shape.charAt(0).toUpperCase() + shape.slice(1);
    });
  }, [products]);

  // Common size labels for frames & sunglasses, used for the Size filter dropdown
  const staticSizes = [
    'Kids',
    'Small',
    'Medium',
    'Large',
    'Oversized',
  ];

  const availableSizes = React.useMemo(() => {
    const sizeSet = new Set<string>();

    // Include static size labels
    staticSizes.forEach((size) => {
      sizeSet.add(size);
    });

    // Include any sizes coming from products (e.g. "48-18-140", "52-18")
    products.forEach(product => {
      const size = (product as any).size || (product as any).frame_size;
      if (size && size.toString().trim() !== '') {
        sizeSet.add(size.toString().trim());
      }
    });

    return Array.from(sizeSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [products]);

  // Extract unique frame materials from products and combine with all materials
  const availableFrameMaterials = React.useMemo(() => {
    const productMaterials = new Set<string>();
    products.forEach(product => {
      if ((product as any).frame_material && (product as any).frame_material.trim() !== '') {
        productMaterials.add((product as any).frame_material.trim());
      }
    });
    
    const allAvailableMaterials = new Set<string>([
      ...allFrameMaterials.map(m => m.toLowerCase()),
      ...Array.from(productMaterials).map(m => m.toLowerCase())
    ]);
    
    const sortedMaterials = Array.from(allAvailableMaterials).sort();
    
    return sortedMaterials.map(material => {
      const productMaterial = Array.from(productMaterials).find(pm => pm.toLowerCase() === material);
      if (productMaterial) {
        return productMaterial;
      }
      return material.charAt(0).toUpperCase() + material.slice(1);
    });
  }, [products]);

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
    <div className="multi-branch-gallery-container min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2 sm:py-3 md:py-4 lg:py-6 xl:py-8">
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

        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */

        /* Extra Small Devices (Portrait phones, less than 320px) */
        @media (max-width: 319px) {
          .multi-branch-gallery-container {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
          .multi-branch-gallery-container .product-card {
            min-height: auto;
          }
        }

        /* Small Devices (Portrait phones, 320px and up) */
        @media (min-width: 320px) and (max-width: 480px) {
          .multi-branch-gallery-container {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
          }
          .multi-branch-gallery-container .product-card {
            min-height: auto;
          }
        }

        /* Medium Devices (Landscape phones, 481px and up) */
        @media (min-width: 481px) and (max-width: 767px) {
          .multi-branch-gallery-container {
            padding-left: 1rem;
            padding-right: 1rem;
            padding-top: 1rem;
            padding-bottom: 1rem;
          }
        }

        /* Large Devices (Tablets, 768px and up) */
        @media (min-width: 768px) and (max-width: 1024px) {
          .multi-branch-gallery-container {
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            padding-top: 1.5rem;
            padding-bottom: 1.5rem;
          }
        }

        /* Extra Large Devices (Small laptops, 1025px and up) */
        @media (min-width: 1025px) and (max-width: 1280px) {
          .multi-branch-gallery-container {
            padding-left: 2rem;
            padding-right: 2rem;
            padding-top: 2rem;
            padding-bottom: 2rem;
          }
        }

        /* XXL Devices (Desktops, 1281px and up) */
        @media (min-width: 1281px) and (max-width: 1919px) {
          .multi-branch-gallery-container {
            padding-left: 2.5rem;
            padding-right: 2.5rem;
            padding-top: 2.5rem;
            padding-bottom: 2.5rem;
          }
        }

        /* XXXL Devices (Large desktops, 1920px and up) */
        @media (min-width: 1920px) {
          .multi-branch-gallery-container {
            padding-left: 3rem;
            padding-right: 3rem;
            padding-top: 3rem;
            padding-bottom: 3rem;
          }
        }

        /* Landscape Orientation Optimizations */
        @media (orientation: landscape) and (max-height: 600px) {
          .multi-branch-gallery-container {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
        }

        /* Portrait Orientation Optimizations */
        @media (orientation: portrait) and (max-width: 768px) {
          .multi-branch-gallery-container {
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }

        /* High DPI Displays (Retina) */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .multi-branch-gallery-container {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        }

        /* Touch Device Optimizations */
        @media (hover: none) and (pointer: coarse) {
          .multi-branch-gallery-container * {
            min-height: 44px;
          }
          .multi-branch-gallery-container .product-card {
            min-height: auto;
          }
        }

        /* Hover Capable Devices (Desktop) */
        @media (hover: hover) and (pointer: fine) {
          .multi-branch-gallery-container {
            /* Desktop-specific hover optimizations */
          }
        }

        /* Print Styles */
        @media print {
          .multi-branch-gallery-container {
            padding: 1rem;
            max-width: 100%;
          }
        }

        /* Reduced Motion Preference */
        @media (prefers-reduced-motion: reduce) {
          .multi-branch-gallery-container * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Container Max Width Responsive */
        @media (max-width: 640px) {
          .multi-branch-gallery-container .max-w-7xl {
            max-width: 100%;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .multi-branch-gallery-container .max-w-7xl {
            max-width: 90%;
          }
        }

        @media (min-width: 1025px) and (max-width: 1280px) {
          .multi-branch-gallery-container .max-w-7xl {
            max-width: 85%;
          }
        }

        @media (min-width: 1281px) {
          .multi-branch-gallery-container .max-w-7xl {
            max-width: 1280px;
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

      {/* Category Filter - Shop By Category */}
      {categories.length > 0 && (
        <div className="max-w-7xl mx-auto mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-5 lg:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
                SHOP BY CATEGORY
              </h3>
            </div>
            
            {/* Category Buttons */}
            <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap gap-2 sm:gap-2.5 md:gap-3">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm md:text-base transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md sm:shadow-lg transform scale-[1.02] sm:scale-105'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                  <span>SHOP ALL</span>
              </button>
              {categories
                .filter((category) => category.is_active !== false) // Only show active categories
                .sort((a, b) => {
                  // Sort by sort_order, then by name
                  if (a.sort_order !== undefined && b.sort_order !== undefined) {
                    return (a.sort_order || 0) - (b.sort_order || 0);
                  }
                  return (a.name || '').localeCompare(b.name || '');
                })
                .map((category) => {
                // Use product_count from API if available, otherwise calculate from loaded products
                const productCount = category.product_count !== undefined 
                  ? category.product_count 
                  : products.filter(p => p.category_id === category.id).length;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      console.log('[ProductGallery] Category button clicked:', { 
                        categoryId: category.id, 
                        categoryName: category.name, 
                        categorySlug: category.slug 
                      });
                      setSelectedCategory(category.id.toString());
                    }}
                    className={`inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm md:text-base transition-all duration-200 whitespace-nowrap gap-1.5 sm:gap-2 ${
                      selectedCategory === category.id.toString()
                        ? 'text-white shadow-md sm:shadow-lg transform scale-[1.02] sm:scale-105'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: selectedCategory === category.id.toString() ? (category.color || '#3B82F6') : undefined,
                        opacity: category.is_active === false ? 0.6 : 1,
                    }}
                  >
                    {category.icon && <span className="text-sm sm:text-base md:text-lg leading-none">{category.icon}</span>}
                      <span>{category.name.toUpperCase()}</span>
                      {category.is_active === false && (
                        <span className="ml-1 text-xs opacity-75">(Inactive)</span>
                      )}
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
        </div>
      )}

      {/* Product Filters - Gender, Brand, Color, Shape, Size, Frame Material */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 lg:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-3 sm:mb-4">Product Filters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
            {/* Gender Filter */}
            <div>
              <Label htmlFor="gender-filter" className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                Gender
              </Label>
              <Select value={selectedGender} onValueChange={setSelectedGender}>
                <SelectTrigger id="gender-filter" className="w-full">
                  <SelectValue placeholder="All Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Gender</SelectItem>
                  <SelectItem value="men">Men&apos;s</SelectItem>
                  <SelectItem value="women">Women&apos;s</SelectItem>
                  <SelectItem value="kids">Kids</SelectItem>
                  <SelectItem value="unisex">Unisex</SelectItem>
                </SelectContent>
              </Select>
              </div>

            {/* Brand / Type Filter */}
            <div>
              <Label htmlFor="brand-filter" className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                Brand / Type
              </Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger id="brand-filter" className="w-full">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  <SelectItem value="__branded__">Branded</SelectItem>
                  <SelectItem value="__non_branded__">Non-Branded</SelectItem>
                  {/* Show brand names when not showing Non-Branded */}
                  {selectedBrand !== '__non_branded__' && (
                    <>
                      {(selectedBrand === '__branded__' || selectedBrand === 'all') && (
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Brands</div>
                      )}
                      {allAvailableBrands
                        .filter((brand) => brand && brand.trim() !== '')
                        .map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  {/* Show lens types only when showing all (not when Branded/Non-Branded is selected) */}
                  {selectedBrand === 'all' && availableLensTypes.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Lens Types</div>
                      {availableLensTypes.map((lensType) => (
                        <SelectItem key={lensType} value={lensType}>
                          {lensType}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Color Filter */}
            <div>
              <Label htmlFor="color-filter" className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                Color
              </Label>
              <Select value={selectedColor} onValueChange={setSelectedColor}>
                <SelectTrigger id="color-filter" className="w-full">
                  <SelectValue placeholder="All Colors" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Colors</SelectItem>
                  {availableColors.map((color) => {
                    const productCount = products.filter(p => 
                      (p as any).color && 
                      (p as any).color?.toLowerCase() === color.toLowerCase()
                    ).length;
                    return (
                      <SelectItem key={color} value={color}>
                        {color} {productCount > 0 && `(${productCount})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              </div>

            {/* Shape Filter */}
            <div>
              <Label htmlFor="shape-filter" className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                Shape
              </Label>
              <Select value={selectedShape} onValueChange={setSelectedShape}>
                <SelectTrigger id="shape-filter" className="w-full">
                  <SelectValue placeholder="All Shapes" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Shapes</SelectItem>
                  {availableShapes.map((shape) => {
                    const productCount = products.filter(p => 
                      (p as any).shape && 
                      (p as any).shape?.toLowerCase() === shape.toLowerCase()
                    ).length;
                    return (
                      <SelectItem key={shape} value={shape}>
                        {shape} {productCount > 0 && `(${productCount})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Size Filter */}
            <div>
              <Label htmlFor="size-filter" className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                Size
              </Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger id="size-filter" className="w-full">
                  <SelectValue placeholder="All Sizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {availableSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frame Material Filter */}
            <div>
              <Label htmlFor="frame-material-filter" className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                Frame Material
              </Label>
              <Select value={selectedFrameMaterial} onValueChange={setSelectedFrameMaterial}>
                <SelectTrigger id="frame-material-filter" className="w-full">
                  <SelectValue placeholder="All Materials" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Materials</SelectItem>
                  {availableFrameMaterials.map((material) => {
                    const productCount = products.filter(p => 
                      (p as any).frame_material && 
                      (p as any).frame_material?.toLowerCase() === material.toLowerCase()
                    ).length;
                    return (
                      <SelectItem key={material} value={material}>
                        {material} {productCount > 0 && `(${productCount})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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

