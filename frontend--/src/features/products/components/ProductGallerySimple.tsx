import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, ShoppingCart, Package, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
// LocalStorage-only mode (no backend calls)

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock_quantity: number;
  image_paths: string[];
  is_active: boolean;
  created_at: string;
}

interface Reservation {
  id: string;
  product_id: string;
  quantity: number;
  status: string;
  created_at: string;
}

const PRODUCTS_STORAGE_KEY = 'localStorage_products';
const RESERVATIONS_STORAGE_KEY = 'localStorage_reservations';

export const ProductGallerySimple: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;

  const [products, setProducts] = useState<Product[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newReservationProductId, setNewReservationProductId] = useState<string | null>(null);
  const [reservationQuantity, setReservationQuantity] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedImageIndices, setSelectedImageIndices] = useState<{[productId: string]: number}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load products and reservations on mount
  useEffect(() => {
    loadProducts();
    if (role === 'customer') {
      loadReservations();
    }
    
    // Listen for product deletion events to clear cache
    const handleProductDeletion = (event: CustomEvent) => {
      console.log('Product deleted, clearing localStorage cache:', event.detail.productId);
      // Clear the localStorage cache
      localStorage.removeItem(PRODUCTS_STORAGE_KEY);
      // Reload products from API
      loadProducts();
    };
    
    window.addEventListener('productDeleted', handleProductDeletion as EventListener);
    
    return () => {
      window.removeEventListener('productDeleted', handleProductDeletion as EventListener);
    };
  }, [role]);

  const loadProducts = () => {
    try {
      const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (stored) setProducts(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading products:', e);
    }
  };

  const loadReservations = () => {
    try {
      const stored = localStorage.getItem(RESERVATIONS_STORAGE_KEY);
      if (stored) {
        const parsedReservations = JSON.parse(stored);
        setReservations(parsedReservations);
      }
    } catch (error) {
      console.error('Error loading reservations:', error);
    }
  };

  const saveProductsLocal = (newProducts: Product[]) => {
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(newProducts));
      setProducts(newProducts);
    } catch {}
  };

  const saveReservations = (newReservations: Reservation[]) => {
    try {
      localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(newReservations));
      setReservations(newReservations);
    } catch (error) {
      console.error('Error saving reservations:', error);
    }
  };

  // Handle input changes for editing product
  const handleEditChange = (field: keyof Product, value: string | number | boolean) => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, [field]: value });
  };

  // Compress an image file to a reasonable size and quality, return data URL
  const compressImageFile = (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.8, outputType: 'image/jpeg' | 'image/webp' = 'image/jpeg'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const aspect = width / height;
          if (width > maxWidth) {
            width = maxWidth;
            height = Math.round(width / aspect);
          }
          if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height * aspect);
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Invalid image'));
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProduct) return;
    
    const files = event.target.files;
    if (!files) return;

    const newImages: string[] = [...editingProduct.image_paths];
    
    // Compress files, convert to base64 and add to images (max 8 images)
    const allowed = Array.from(files).slice(0, 8 - newImages.length);
    for (const file of allowed) {
      if (!file.type.startsWith('image/')) continue;
      try {
        // Prefer webp if browser supports it; fallback jpeg
        const outputType: 'image/jpeg' | 'image/webp' = 'image/webp';
        const compressed = await compressImageFile(file, 1280, 1280, 0.8, outputType);
        if (newImages.length < 8) {
          newImages.push(compressed);
          setEditingProduct({ ...editingProduct, image_paths: newImages });
        }
      } catch (err) {
        console.error('Image compression failed:', err);
      }
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    if (!editingProduct) return;
    const newImages = editingProduct.image_paths.filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, image_paths: newImages });
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Get selected image index for a product
  const getSelectedImageIndex = (productId: string): number => {
    return selectedImageIndices[productId] || 0;
  };

  // Set selected image index for a product
  const setSelectedImageIndex = (productId: string, index: number) => {
    setSelectedImageIndices(prev => ({
      ...prev,
      [productId]: index
    }));
  };

  // Start editing a product or create new
  const startEditing = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
    } else {
      setEditingProduct({
        id: Date.now().toString(),
        name: '',
        description: '',
        price: 0,
        category: '',
        stock_quantity: 0,
        image_paths: [],
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingProduct(null);
  };

  // Save product (add or update)
  const saveProduct = async () => {
    if (!editingProduct) return;
    if (!editingProduct.name.trim()) {
      alert('Product name is required.');
      return;
    }
    if (editingProduct.price < 0) {
      alert('Price must be 0 or greater.');
      return;
    }
    const exists = products.some(p => p.id === editingProduct.id);
    const updated = exists
      ? products.map(p => (p.id === editingProduct.id ? editingProduct : p))
      : [editingProduct, ...products];
    saveProductsLocal(updated);
    setEditingProduct(null);
  };

  // Delete product
  const deleteProduct = async (productId: string) => {
    const newProducts = products.filter(p => p.id !== productId);
    saveProductsLocal(newProducts);
  };

  // Create reservation
  const createReservation = () => {
    if (!newReservationProductId || !user) return;

    const newReservation: Reservation = {
      id: Date.now().toString(),
      product_id: newReservationProductId,
      quantity: reservationQuantity,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const newReservations = [...reservations, newReservation];
    saveReservations(newReservations);
    setNewReservationProductId(null);
    setReservationQuantity(1);
  };

  // Get reservation count for a product
  const getReservationCount = (productId: string): number => {
    return reservations.filter(r => r.product_id === productId).length;
  };

  // (Removed sample product helper to enforce manual input only)

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Product Count and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Product Gallery</h2>
          <span className="text-sm text-gray-600">({products.length} products)</span>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {(role === 'admin' || role === 'staff') && (
          <div className="flex gap-2">
            <Button onClick={() => startEditing()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        )}
        </div>

      {/* Product Edit Form (Admin/Staff only) */}
      {editingProduct && (role === 'admin' || role === 'staff') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {products.find(p => p.id === editingProduct.id) ? 'Edit Product' : 'Add New Product'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Input
                  value={editingProduct.category}
                  onChange={(e) => handleEditChange('category', e.target.value)}
                  placeholder="Product category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <Input
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) => handleEditChange('price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  />
                </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                <Input
                  type="number"
                  value={editingProduct.stock_quantity}
                  onChange={(e) => handleEditChange('stock_quantity', parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={editingProduct.description}
                onChange={(e) => handleEditChange('description', e.target.value)}
                placeholder="Product description"
                  />
                </div>

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium mb-2">Product Images (Max 8)</label>
              <div className="space-y-4">
                {/* Current Images */}
                {editingProduct.image_paths.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {editingProduct.image_paths.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`Product image ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                  ))}
                </div>
                )}
                
                {/* Upload Button */}
                {editingProduct.image_paths.length < 8 && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={triggerFileInput}
                      className="w-full"
                      disabled={editingProduct.image_paths.length >= 8}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Images ({editingProduct.image_paths.length}/8)
                    </Button>
                </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={saveProduct}>
                Save Product
              </Button>
              <Button variant="outline" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

            {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Product Image Gallery */}
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center relative">
                {product.image_paths && product.image_paths.length > 0 ? (
                  <>
                    <img
                      src={(product.image_order || product.image_paths || [])[getSelectedImageIndex(product.id)]}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                    
                    {/* Image Navigation */}
                    {(product.image_order || product.image_paths || []).length > 1 && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => setSelectedImageIndex(product.id, Math.max(0, getSelectedImageIndex(product.id) - 1))}
                          disabled={getSelectedImageIndex(product.id) === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => setSelectedImageIndex(product.id, Math.min((product.image_order || product.image_paths || []).length - 1, getSelectedImageIndex(product.id) + 1))}
                          disabled={getSelectedImageIndex(product.id) === (product.image_order || product.image_paths || []).length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        
                        {/* Image Indicators */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                          {(product.image_order || product.image_paths || []).map((_, index) => (
                            <button
                              key={index}
                              className={`w-2 h-2 rounded-full ${
                                index === getSelectedImageIndex(product.id) ? 'bg-white' : 'bg-white/50'
                              }`}
                              onClick={() => setSelectedImageIndex(product.id, index)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <Package className="w-16 h-16 text-gray-400" />
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
                  {(role === 'admin' || role === 'staff') && (
                    <div className="flex gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteProduct(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                </div>
              )}
            </div>
                
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                <p className="font-bold text-lg mb-2">₱{Number(product.price || 0).toFixed(2)}</p>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">
                    Stock: {product.stock_quantity}
                  </span>
                </div>

                {role === 'customer' && product.is_active && product.stock_quantity > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max={product.stock_quantity}
                        value={newReservationProductId === product.id ? reservationQuantity : 1}
                        onChange={(e) => setReservationQuantity(parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          setNewReservationProductId(product.id);
                          setReservationQuantity(1);
                        }}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        Reserve
                      </Button>
                    </div>
                    {newReservationProductId === product.id && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={createReservation}
                      >
                        Confirm Reservation
                      </Button>
              )}
            </div>
                )}

                {role === 'customer' && product.stock_quantity === 0 && (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}

                {role !== 'customer' && (
                  <div className="text-sm text-gray-600">
                    Reservations: {getReservationCount(product.id)}
                  </div>
        )}
      </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? 'Try adjusting your search criteria.'
                : 'No products are currently available.'}
            </p>
            {(role === 'admin' || role === 'staff') && (
              <Button onClick={() => startEditing()}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Product
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
