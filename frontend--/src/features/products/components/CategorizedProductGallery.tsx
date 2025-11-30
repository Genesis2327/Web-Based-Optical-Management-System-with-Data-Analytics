import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Tag, Star, ShoppingCart, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_paths: string[];
  primary_image: string;
  brand: string;
  model: string;
  sku: string;
  category: {
    id: number;
    name: string;
    color: string;
    icon: string;
  };
  branch_availability: Array<{
    branch: {
      id: number;
      name: string;
      code: string;
    };
    available_quantity: number;
    is_available: boolean;
  }>;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  icon: string;
  product_count: number;
}

const CategorizedProductGallery: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('newest');

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchProducts();
    
    // Listen for product deletion events to refresh immediately
    const handleProductDeletion = (event: CustomEvent) => {
      console.log('Product deleted, refreshing categorized gallery:', event.detail.productId);
      // Immediately refresh products to reflect deletion
      fetchProducts();
    };
    
    window.addEventListener('productDeleted', handleProductDeletion as EventListener);
    
    return () => {
      window.removeEventListener('productDeleted', handleProductDeletion as EventListener);
    };
  }, [selectedCategory, selectedBrand, sortBy]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/product-categories', {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedBrand !== 'all' && selectedBrand !== '') params.append('brand', selectedBrand);
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sort', sortBy);

      const response = await fetch(`/api/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Brand names from the Branded folder structure (Frames)
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

  // Brand dropdown contents – match PublicProductGallery behavior
  const getBrands = () => {
    // Collect brands from current products, normalizing case
    const productBrandMap = new Map<string, string>(); // Map<normalized, original>
    products.forEach((p) => {
      if (p.brand && p.brand.trim() !== '') {
        const normalized = p.brand.trim().toLowerCase();
        if (!productBrandMap.has(normalized)) {
          productBrandMap.set(normalized, p.brand.trim());
        }
      }
    });

    // Work out selected category slug to know when to add static frame brands
    const selectedCategorySlug =
      selectedCategory !== 'all'
        ? categories.find((c) => c.id.toString() === selectedCategory)?.slug?.toLowerCase() || ''
        : 'all';

    const isFramesCategory =
      selectedCategorySlug === 'frames' ||
      selectedCategorySlug === 'eyeglass-frames' ||
      selectedCategorySlug === '' ||
      selectedCategorySlug === 'all';

    // Only add static frame brands for Frames / All (same as public gallery)
    if (isFramesCategory) {
      brandedFrameBrands.forEach((brand) => {
        const normalized = brand.toLowerCase();
        if (!productBrandMap.has(normalized)) {
          productBrandMap.set(normalized, brand);
        }
      });
    }

    // Sort by normalized name, return original casing
    const sorted = Array.from(productBrandMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return sorted.map(([normalized, original]) => original);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getStorageUrl = (path: string) => {
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
    const baseUrl = apiBaseUrl.replace('/api', '');
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${baseUrl}/storage/${cleanPath}`;
  };

  return (
    <div className="categorized-product-gallery-container min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <style>{`
        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */
        
        @media (max-width: 319px) {
          .categorized-product-gallery-container {
            padding: 0.5rem;
          }
          .categorized-product-gallery-container .container {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
          }
        }
        
        @media (min-width: 320px) and (max-width: 480px) {
          .categorized-product-gallery-container {
            padding: 0.75rem;
          }
          .categorized-product-gallery-container .container {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
        }
        
        @media (min-width: 481px) and (max-width: 767px) {
          .categorized-product-gallery-container {
            padding: 1rem;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1024px) {
          .categorized-product-gallery-container {
            padding: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) and (max-width: 1280px) {
          .categorized-product-gallery-container {
            padding: 2rem;
          }
        }
        
        @media (min-width: 1281px) and (max-width: 1919px) {
          .categorized-product-gallery-container {
            padding: 2.5rem;
          }
        }
        
        @media (min-width: 1920px) {
          .categorized-product-gallery-container {
            padding: 3rem;
          }
        }
        
        @media (orientation: landscape) and (max-height: 600px) {
          .categorized-product-gallery-container {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
        }
        
        @media (hover: none) and (pointer: coarse) {
          .categorized-product-gallery-container * {
            min-height: 44px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .categorized-product-gallery-container * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2 sm:py-3 md:py-4 lg:py-6 xl:py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Product Gallery</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover our wide range of optical products, carefully organized by categories for easy browsing.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name} ({category.product_count})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="w-48">
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
                        {getBrands().map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.slice(0, 7).map((category) => (
              <TabsTrigger key={category.id} value={category.id.toString()}>
                <div className="flex items-center">
                  <div 
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </div>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Products Grid/List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
          }>
            {filteredProducts.map((product) => (
              <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="relative">
                  {product.primary_image_path && (
                    <img
                      src={getStorageUrl(product.primary_image_path)}
                      alt={product.name}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute top-2 right-2">
                    <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                      <span className="text-sm text-gray-500">{product.brand}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-blue-600">₱{product.price.toFixed(2)}</span>
                      <div className="flex items-center text-sm text-gray-500">
                        <Package className="w-4 h-4 mr-1" />
                        {product.stock_quantity}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Button className="flex-1 mr-2">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
                      <Button variant="outline" size="sm">
                        <Star className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Results Summary */}
        {!loading && filteredProducts.length > 0 && (
          <div className="mt-8 text-center text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        )}
      </div>
    </div>
  );
};

export default CategorizedProductGallery;




