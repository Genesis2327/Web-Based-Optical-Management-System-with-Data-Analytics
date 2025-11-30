import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Eye, EyeOff, Upload, Save, X, Building2, Package, AlertTriangle, Search, Grid3x3, List, RefreshCw, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/services/productApi';
import { useBranch } from '@/contexts/BranchContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import BranchFilter from '@/components/common/BranchFilter';
import { getStorageUrl } from '@/utils/imageUtils';
import { ImageReorderer } from '@/features/products/components/ImageReorderer';
import { StockManagementModal } from '@/features/products/components/StockManagementModal';
import { API_BASE_URL } from '@/config/api';
import { getLensTypes, LensType } from '@/services/lensTypeApi';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_paths: string[];
  primary_image?: string;
  is_active: boolean;
}

interface BranchStock {
  id?: number;
  product_id: number;
  branch_id: number;
  stock_quantity: number;
  reserved_quantity?: number;
  branch: {
    id: number;
    name: string;
    code?: string;
  };
}

const AdminProductManagement: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    gender: '',
    lens_type: '',
    is_active: true
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [imageOrder, setImageOrder] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deletedProductIds, setDeletedProductIds] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [shapeFilter, setShapeFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [frameMaterialFilter, setFrameMaterialFilter] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [availableBranches, setAvailableBranches] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [showStockModal, setShowStockModal] = useState<boolean>(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const preventAutoRefresh = useRef(false); // Flag to prevent auto-refresh after manual update
  const [lensTypes, setLensTypes] = useState<LensType[]>([]);
  const [loadingLensTypes, setLoadingLensTypes] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug: Monitor products state changes
  useEffect(() => {
    console.log('Products state changed:', products.length, 'products');
    if (products.length > 0) {
      console.log('First product:', products[0]);
      const product42 = products.find(p => p.id === 42);
      if (product42) {
        console.log('Product 42 in state:', product42);
      }
    }
  }, [products]);

  useEffect(() => {
    fetchProductsList(true); // Force initial fetch or when non-search filters change
    fetchCategories();
    
    // Load branches for branch selector
    (async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE_URL}/branches`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.data || []);
          setAvailableBranches(list.map((b: any) => ({ id: b.id, name: b.name, code: b.code || '' })));
        }
      } catch {}
    })();
  }, [categoryFilter, genderFilter]); // Refresh when main filters change (search handled separately with debounce)

  // Also refresh when search term changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductsList();
    }, 500); // Debounce search by 500ms

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchCategories = async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/product-categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Categories fetched:', data);
        // Handle both response formats: {data: [...]} or {categories: [...]} or [...]
        const categoriesArray = data.data || data.categories || (Array.isArray(data) ? data : []);
        setCategories(categoriesArray.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
        })));
      } else {
        console.error('Failed to fetch categories:', response.status, response.statusText);
        // Fallback to default categories if API fails
        setCategories([
          { id: 1, name: 'Frames' },
          { id: 2, name: 'Contact Lenses' },
          { id: 3, name: 'Eye Care Products' },
          { id: 4, name: 'Sunglasses' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to default categories if API fails
      setCategories([
        { id: 1, name: 'Frames' },
        { id: 2, name: 'Contact Lenses' },
        { id: 3, name: 'Eye Care Products' },
        { id: 4, name: 'Sunglasses' },
      ]);
    }
  };

  const fetchProductsList = async (force = false) => {
    try {
      setLoading(true);
      console.log('=== FETCHING PRODUCTS LIST ===', { force, timestamp: new Date().toISOString() });
      const categoryId = categoryFilter !== 'all' ? parseInt(categoryFilter) : undefined;
      const gender = genderFilter !== 'all' ? genderFilter : undefined;
      const result = await getProducts(searchTerm, categoryId, undefined, undefined, gender);
      console.log('Products fetched result:', result);
      console.log('Result type:', typeof result);
      console.log('Is array:', Array.isArray(result));
      
      let productsArray: Product[] = [];
      
      if (Array.isArray(result)) {
        productsArray = result;
        console.log('✓ Using direct array with', productsArray.length, 'items');
      } else if (result && typeof result === 'object' && 'data' in result && Array.isArray((result as any).data)) {
        productsArray = (result as any).data;
        console.log('✓ Using data property with', productsArray.length, 'items');
      } else {
        console.warn('✗ Unexpected products data structure:', result);
        productsArray = [];
      }
      
      // Log first few products to verify data
      if (productsArray.length > 0) {
        console.log('Sample products from fetch:', productsArray.slice(0, 3).map(p => ({
          id: p.id,
          name: p.name,
          price: p.price
        })));
      }
      
      // Always create a new array reference to force React re-render
      console.log('Setting products state with', productsArray.length, 'items');
      const newProductsArray = productsArray.map(p => ({ ...p })); // Deep copy to ensure new references
      setProducts(newProductsArray);
      
      console.log('✓ Products state updated - React should re-render now');
      console.log('State will have', newProductsArray.length, 'products');
      console.log('=== FETCH COMPLETE ===');
    } catch (error) {
      console.error('✗ Error fetching products:', error);
      toast.error('Failed to fetch products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    await fetchProductsList(true); // Force manual refresh
    setRefreshTrigger(prev => prev + 1);
    toast.success('Products refreshed successfully');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (!formData.price || parseFloat(formData.price) < 0) {
      toast.error('Valid price is required');
      return;
    }
    
    try {
      // Regular product creation/update
      const fd = new FormData();
      
      // Always append these fields explicitly
      const trimmedName = formData.name.trim();
      const trimmedDescription = (formData.description || '').trim();
      const priceValue = parseFloat(formData.price) || 0;
      const categoryId = formData.category_id || '';
      const isActive = formData.is_active ? '1' : '0';
      
      fd.append('name', trimmedName);
      fd.append('description', trimmedDescription);
      fd.append('price', priceValue.toString());
      fd.append('is_active', isActive);
      fd.append('category_id', categoryId);
      if (formData.gender && formData.gender !== '') {
        fd.append('gender', formData.gender);
      }
      if (formData.lens_type && formData.lens_type !== '') {
        fd.append('lens_type', formData.lens_type);
      }
      
      console.log('=== FORM DATA BEING SENT ===', {
        name: trimmedName,
        description: trimmedDescription,
        price: priceValue.toString(),
        gender: formData.gender,
        lens_type: formData.lens_type,
        is_active: isActive,
        category_id: categoryId,
        editingProduct: editingProduct ? editingProduct.id : null
      });
      
      // Verify FormData contents
      console.log('FormData entries:');
      for (let [key, value] of fd.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: [File: ${value.name}, ${value.size} bytes]`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
      
      // Handle images and primary image selection
      // Always send existing images when editing (even if empty, to clear images if needed)
      if (editingProduct) {
        // When editing, always send existing_images (even if empty array to clear)
        fd.append('existing_images', JSON.stringify(existingImages));
        
        // Add new files if any
        if (selectedFiles.length > 0) {
          selectedFiles.forEach((file, index) => {
            fd.append(`images[${index}]`, file);
          });
        }
      } else {
        // When creating, only send new files
        if (selectedFiles.length > 0) {
          selectedFiles.forEach((file, index) => {
            fd.append(`images[${index}]`, file);
          });
        }
      }

      if (editingProduct) {
        console.log('Updating product:', editingProduct.id, 'with data:', {
          name: formData.name,
          price: formData.price,
          description: formData.description,
          category_id: formData.category_id,
          is_active: formData.is_active,
          existingImages: existingImages,
          selectedFiles: selectedFiles.length
        });
        
        // Log FormData contents
        console.log('FormData contents:');
        for (let [key, value] of fd.entries()) {
          if (value instanceof File) {
            console.log(`${key}:`, `[File: ${value.name}, ${value.size} bytes]`);
          } else {
            console.log(`${key}:`, value);
          }
        }
        
        try {
          console.log('=== STARTING PRODUCT UPDATE ===');
          console.log('Product ID:', editingProduct.id);
          console.log('Form Data:', {
            name: formData.name,
            price: formData.price,
            category_id: formData.category_id,
            is_active: formData.is_active
          });
          
          const productId = editingProduct.id;
          const oldProduct = products.find(p => p.id === productId);
          console.log('Product before update:', oldProduct ? {
            id: oldProduct.id,
            name: oldProduct.name,
            price: oldProduct.price
          } : 'NOT FOUND');
          
          const result = await updateProduct(String(productId), fd);
          console.log('Update API result:', result);
          
          // Extract the updated product data from response
          const updatedProductData = (result as any)?.product || result;
          console.log('Extracted updated product data:', updatedProductData);
          console.log('Updated price from API:', updatedProductData?.price);
          
          // Close modal and reset form FIRST (before state updates)
          resetForm();
          
          // Wait a moment to ensure backend has committed the transaction
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Force a complete refresh from the server - this ensures we get the latest data
          console.log('Force refreshing products list from server...');
          await fetchProductsList(true);
          
          // Increment refresh trigger to force React to re-render all product cards
          setRefreshTrigger(prev => {
            const newValue = prev + 1;
            console.log('Refresh trigger incremented:', newValue);
            return newValue;
          });
          
          // Double-check: verify the updated product in state
          setTimeout(() => {
            const updatedProduct = products.find(p => p.id === productId);
            console.log('Product in state after update:', updatedProduct ? {
              id: updatedProduct.id,
              name: updatedProduct.name,
              price: updatedProduct.price
            } : 'NOT FOUND');
          }, 500);
          
          toast.success('Product updated successfully');
          
          console.log('=== PRODUCT UPDATE COMPLETE ===');
        } catch (updateError: any) {
          console.error('✗ Update error details:', updateError);
          console.error('✗ Update error response:', updateError?.response?.data);
          throw updateError; // Re-throw to be caught by outer catch
        }
      } else {
        await createProduct(fd);
        toast.success('Product created successfully');
        await fetchProductsList(true); // Force re-fetch after create
        resetForm();
      }
    } catch (error: any) {
      console.error('Product creation error:', error);
      
      let errorMessage = 'Failed to save product';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (typeof errors === 'object' && errors !== null) {
          try {
            errorMessage = Object.values(errors).flat().join(', ');
          } catch (e) {
            errorMessage = 'Validation errors occurred';
          }
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(String(productId));
      toast.success('Product deleted successfully');
        setDeletedProductIds(prev => new Set([...prev, productId]));
        await fetchProductsList(true); // Force re-fetch after delete
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('Failed to delete product');
      }
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, product: Product) => {
    console.log('=== handleToggleStatus CALLED ===', product.id, product.is_active);
    
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent auto-refresh while updating
    preventAutoRefresh.current = true;
    
    const newStatus = !product.is_active;
    console.log('Toggling status for product:', product.id, 'from', product.is_active, 'to', newStatus);
    
    // Optimistic update - update UI immediately
    setProducts(prevProducts => 
      prevProducts.map(p => 
        p.id === product.id 
          ? { ...p, is_active: newStatus }
          : p
      )
    );
    
    try {
      // Since we're only updating is_active (no file upload), use JSON instead of FormData
      // FormData with PUT requests can be problematic in Laravel
      const token = sessionStorage.getItem('auth_token');
      
      console.log('Sending JSON update request with is_active:', newStatus);
      
      const response = await fetch(`${API_BASE_URL}/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          is_active: newStatus
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update product' }));
        throw new Error(errorData.message || 'Failed to update product');
      }
      
      const responseData = await response.json();
      const result = responseData.product || responseData;
      
      console.log('API call completed, result:', result);
      console.log('Toggle status result:', result);
      console.log('Toggle status result type:', typeof result);
      console.log('Toggle status result is_product:', (result as any)?.product);
      
      // Extract product from response - API returns { message, product } or just product
      const updatedProduct = (result as any)?.product || result;
      console.log('Updated product from API:', updatedProduct);
      console.log('Updated product is_active type:', typeof updatedProduct?.is_active);
      console.log('Updated product is_active value:', updatedProduct?.is_active);
      
      // Extract is_active from API response
      // Trust the API response, but fallback to what we sent if API doesn't return it
      let finalStatus = newStatus; // Start with what we're trying to set
      
      // Try to get the actual status from API response
      if (updatedProduct && updatedProduct.hasOwnProperty('is_active')) {
        const apiStatus = updatedProduct.is_active;
        // Convert string "1"/"0" or string "true"/"false" to boolean
        if (typeof apiStatus === 'string') {
          finalStatus = ['1', 'true', 'yes', 'on'].includes(apiStatus.toLowerCase());
        } else {
          finalStatus = Boolean(apiStatus);
        }
        console.log('Got status from updatedProduct:', finalStatus, 'raw:', apiStatus);
      } else if ((result as any) && (result as any).hasOwnProperty('is_active')) {
        const apiStatus = (result as any).is_active;
        if (typeof apiStatus === 'string') {
          finalStatus = ['1', 'true', 'yes', 'on'].includes(apiStatus.toLowerCase());
        } else {
          finalStatus = Boolean(apiStatus);
        }
        console.log('Got status from result:', finalStatus, 'raw:', apiStatus);
      } else {
        // API didn't return is_active, trust what we sent
        console.log('API did not return is_active, using newStatus:', newStatus);
        finalStatus = newStatus;
      }
      
      console.log('Final status calculated:', finalStatus, 'type:', typeof finalStatus);
      
      // Update state with explicit is_active
      // Use functional update to ensure we're working with the latest state
      setProducts(prevProducts => {
        const updated = prevProducts.map(p => {
          if (p.id === product.id) {
            console.log('Updating product in state:', p.id, 'old status:', p.is_active, 'new status:', finalStatus);
            // Create a new object with explicit is_active value
            return {
              ...p,
              is_active: finalStatus, // Explicitly set this first
            };
          }
          return p;
        });
        console.log('Updated products array, product', product.id, 'now has is_active:', updated.find(p => p.id === product.id)?.is_active);
        return updated;
      });
      
      console.log('State update completed with is_active:', finalStatus);
      
      toast.success(`Product ${finalStatus ? 'activated' : 'deactivated'} successfully`);
      
      // Re-enable auto-refresh after a delay to prevent overwriting
      setTimeout(() => {
        preventAutoRefresh.current = false;
        console.log('Auto-refresh re-enabled');
      }, 2000); // Wait 2 seconds before allowing auto-refresh
      
    } catch (error: any) {
      console.error('Error toggling status:', error);
      console.error('Error response:', error.response?.data);
      
      // Revert optimistic update on error
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === product.id 
            ? { ...p, is_active: product.is_active }
            : p
        )
      );
      
      toast.error(error.response?.data?.message || error.message || 'Failed to toggle product status');
      
      // Re-enable auto-refresh even on error
      setTimeout(() => {
        preventAutoRefresh.current = false;
        console.log('Auto-refresh re-enabled after error');
      }, 2000);
    }
  };


  const handleManageStock = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedProductForStock(product);
      setShowStockModal(true);
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      console.log('=== EDIT BUTTON CLICKED ===');
      console.log('Editing product:', product);
      console.log('Product ID:', product.id);
      console.log('Product keys:', Object.keys(product));
      console.log('Product category_id:', (product as any).category_id);
      console.log('Product category:', (product as any).category);
      
      if (!product || !product.id) {
        toast.error('Invalid product data. Cannot edit.');
        console.error('Invalid product:', product);
        return;
      }
      
      // Set editing product FIRST
      setEditingProduct(product);
      
      // Get ordered images (prefer image_order, fallback to image_paths)
      const orderedImages = (product as any).image_order && Array.isArray((product as any).image_order) 
        ? (product as any).image_order 
        : (product.image_paths && Array.isArray(product.image_paths) ? product.image_paths : []);
      
      // Populate form with existing product data
      const categoryId = (product as any).category_id || (product as any).category?.id || null;
      
      const newFormData = {
        name: product.name || '',
        description: product.description || '',
        price: product.price?.toString() || '0',
        category_id: categoryId ? categoryId.toString() : '',
        gender: (product as any).gender || '',
        lens_type: (product as any).lens_type || '',
        is_active: product.is_active !== undefined ? product.is_active : true
      };
      
      console.log('Setting form data:', newFormData);
      console.log('Categories available:', categories);
      console.log('Category match:', categories.find(c => c.id.toString() === newFormData.category_id));
      
      setFormData(newFormData);
      
      // Set existing images using ordered images
      if (orderedImages && orderedImages.length > 0) {
        setExistingImages(orderedImages);
        setImageOrder([...orderedImages]);
        
        // Set primary image index if primary_image is set
        if (product.primary_image) {
          const primaryIndex = orderedImages.findIndex((img: string) => img === product.primary_image);
          setPrimaryImageIndex(primaryIndex >= 0 ? primaryIndex : 0);
        } else {
          setPrimaryImageIndex(0);
        }
      } else {
        setExistingImages([]);
        setImageOrder([]);
        setPrimaryImageIndex(0);
      }
      
      // Clear selected files (new files will be added separately)
      setSelectedFiles([]);
      
      // Open modal AFTER all state is set
      // Use setTimeout to ensure state updates are processed
      setTimeout(() => {
        setShowModal(true);
        console.log('Modal opened for product:', product.id);
      }, 0);
      
      toast.success(`Editing product: ${product.name}`);
    } catch (error) {
      console.error('Error in handleEdit:', error);
      toast.error('Failed to open edit form. Please try again.');
    }
  };

  // Handle stock save
  const handleStockSave = async (stockData: any[]) => {
    if (!selectedProductForStock) return;
    
    try {
      console.log('Saving stock for product:', selectedProductForStock.id);
      console.log('Stock data:', stockData);
      
      const token = sessionStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }

      // Prepare bulk updates for the backend
      // Include ALL stock values, including 0 (zero is a valid stock quantity)
      const updates = [];
      
      for (const stock of stockData) {
        // Include stock even if it's 0 - zero is a valid quantity
        const stockQuantity = parseInt(String(stock.stockQuantity || 0), 10);
        
        if (isNaN(stockQuantity) || stockQuantity < 0) {
          console.warn(`Invalid stock quantity for branch ${stock.branchId}:`, stock.stockQuantity);
          continue;
        }
          // First, try to find existing branch stock record
          try {
            const existingStockResponse = await fetch(`${API_BASE_URL}/branch-stock-test`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          } 
            });
            
            if (existingStockResponse.ok) {
              const existingStockData = await existingStockResponse.json();
              const existingStock = existingStockData.stock?.find((s: any) => 
                s.product_id === selectedProductForStock.id && s.branch_id === stock.branchId
              );
              
              if (existingStock) {
                // Update existing record (including 0 values)
                updates.push({
                  id: existingStock.id,
                  stock_quantity: stockQuantity // Use parsed value
                });
              } else {
                // Create new record (including 0 values)
                await fetch(`${API_BASE_URL}/branch-stock-test`, {
                  method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    product_id: selectedProductForStock.id,
                    branch_id: stock.branchId,
                    stock_quantity: stockQuantity // Use parsed value
                  })
                });
              }
            }
          } catch (error) {
            console.error('Error checking existing stock:', error);
            // Fallback: try to create new record (including 0 values)
            await fetch(`${API_BASE_URL}/branch-stock-test`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                product_id: selectedProductForStock.id,
                branch_id: stock.branchId,
                stock_quantity: stockQuantity // Use parsed value
              })
            });
          }
      }
      
      // Perform bulk updates if we have any
      if (updates.length > 0) {
        const updateResponse = await fetch(`${API_BASE_URL}/branch-stock-test`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ updates })
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update stock: ${errorText}`);
        }
      }
      
      // Update the product's total stock quantity
      const totalStock = stockData.reduce((total, stock) => total + stock.stockQuantity, 0);
      const productUpdateResponse = await fetch(`${API_BASE_URL}/products/${selectedProductForStock.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stock_quantity: totalStock
        })
      });
      
      if (!productUpdateResponse.ok) {
        console.warn('Failed to update product total stock, but branch stock was updated');
      }
      
      // Refresh the products list to show updated stock
      await fetchProductsList(true); // Force re-fetch after stock update
      
      toast.success('Stock updated successfully!');
      
      // Close modal
      setShowStockModal(false);
      setSelectedProductForStock(null);
    } catch (error: any) {
      console.error('Error saving stock:', error);
      toast.error(`Failed to update stock: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
    const newImages = existingImages.filter((_, i) => i !== index);
    setExistingImages(newImages);
      
      // Adjust primary image index if needed
      if (primaryImageIndex >= newImages.length) {
        setPrimaryImageIndex(Math.max(0, newImages.length - 1));
    } else if (primaryImageIndex >= existingImages.length - 1) {
      setPrimaryImageIndex(Math.max(0, existingImages.length - 2));
      }
    } else {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: '',
      gender: '',
      lens_type: '',
      is_active: true
    });
    setSelectedFiles([]);
    setExistingImages([]);
    setPrimaryImageIndex(0);
    setImageOrder([]);
    setEditingProduct(null);
    setShowModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Static frame brands from folder structure (same as PublicProductGallery)
  const brandedFrameBrands = React.useMemo(
    () => [
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
    ],
    [],
  );

  const allColors = React.useMemo(() => [
    'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink',
    'Orange', 'Brown', 'Gray', 'Grey', 'Silver', 'Gold', 'Navy', 'Beige',
    'Tan', 'Clear', 'Rose Gold', 'Multicolor', 'Transparent',
  ], []);

  const allShapes = React.useMemo(() => [
    'Rectangle', 'Square', 'Round', 'Cat Eye', 'Aviator', 'Geometric',
    'Oval', 'Browline', 'Wayfarer', 'Clubmaster', 'Butterfly', 'Oversized'
  ], []);

  const allFrameMaterials = React.useMemo(() => [
    'Plastic', 'Acetate', 'Metal', 'Titanium', 'Stainless Steel',
    'Aluminum', 'TR-90', 'Carbon Fiber', 'Wood', 'Horn', 'Mixed Materials'
  ], []);

  // Brand dropdown contents – mirror PublicProductGallery (category-aware)
  const allAvailableBrands = React.useMemo(() => {
    const brandMap = new Map<string, string>(); // normalized -> original

    // Add brands that actually exist on products
    products.forEach((product) => {
      if (product.brand && product.brand.trim() !== '') {
        const normalized = product.brand.trim().toLowerCase();
        if (!brandMap.has(normalized)) {
          brandMap.set(normalized, product.brand.trim());
        }
      }
    });

    // Determine current category name to decide when to include frame brands
    const selectedCategoryName =
      categoryFilter !== 'all'
        ? categories.find((c) => c.id.toString() === categoryFilter)?.name?.toLowerCase() || ''
        : 'all';

    const isFramesCategory =
      selectedCategoryName === 'all' ||
      selectedCategoryName === '' ||
      selectedCategoryName.includes('frame');

    // Only merge static frame brands for Frames / All (same as public gallery)
    if (isFramesCategory) {
      brandedFrameBrands.forEach((brand) => {
        const normalized = brand.toLowerCase();
        if (!brandMap.has(normalized)) {
          brandMap.set(normalized, brand);
        }
      });
    }

    const sorted = Array.from(brandMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return sorted.map(([normalized, original]) => original);
  }, [products, categories, categoryFilter, brandedFrameBrands]);

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
      const productColor = Array.from(productColors).find(pc => pc.trim().toLowerCase() === color);
      return productColor || (color.charAt(0).toUpperCase() + color.slice(1));
    });
  }, [products, allColors]);

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
      const productShape = Array.from(productShapes).find(ps => ps.trim().toLowerCase() === shape);
      return productShape || (shape.charAt(0).toUpperCase() + shape.slice(1));
    });
  }, [products, allShapes]);

  // Common size labels for frames & sunglasses used in Product Management filters
  const staticSizes = ['Kids', 'Small', 'Medium', 'Large', 'Oversized'];

  const availableSizes = React.useMemo(() => {
    const sizeSet = new Set<string>();

    // Include static sizes
    staticSizes.forEach((size) => sizeSet.add(size));

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
      const productMaterial = Array.from(productMaterials).find(pm => pm.trim().toLowerCase() === material);
      return productMaterial || (material.charAt(0).toUpperCase() + material.slice(1));
    });
  }, [products, allFrameMaterials]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="admin-product-management-container space-y-6">
      <style>{`
        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */
        
        @media (max-width: 319px) {
          .admin-product-management-container {
            padding: 0.5rem;
          }
        }
        
        @media (min-width: 320px) and (max-width: 480px) {
          .admin-product-management-container {
            padding: 0.75rem;
          }
          .admin-product-management-container h1 {
            font-size: 1.5rem;
          }
        }
        
        @media (min-width: 481px) and (max-width: 767px) {
          .admin-product-management-container {
            padding: 1rem;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1024px) {
          .admin-product-management-container {
            padding: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) and (max-width: 1280px) {
          .admin-product-management-container {
            padding: 2rem;
          }
        }
        
        @media (min-width: 1281px) and (max-width: 1919px) {
          .admin-product-management-container {
            padding: 2.5rem;
          }
        }
        
        @media (min-width: 1920px) {
          .admin-product-management-container {
            padding: 3rem;
          }
        }
        
        @media (orientation: landscape) and (max-height: 600px) {
          .admin-product-management-container {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
        }
        
        @media (hover: none) and (pointer: coarse) {
          .admin-product-management-container * {
            min-height: 44px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .admin-product-management-container * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        @media (max-width: 640px) {
          .admin-product-management-container .max-w-7xl {
            max-width: 100%;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Manage your product inventory and details</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 flex-1 sm:flex-initial"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
        <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
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
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Product Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
              <Select value={categoryFilter} onValueChange={(value: any) => setCategoryFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={genderFilter} onValueChange={(value: any) => setGenderFilter(value)}>
                <SelectTrigger className="w-full">
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
              
              <Select value={brandFilter} onValueChange={(value: any) => setBrandFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Brands</SelectItem>
                  <SelectItem value="__branded__">Branded</SelectItem>
                  <SelectItem value="__non_branded__">Non-Branded</SelectItem>
                  {/* Show brand names when not showing Non-Branded */}
                  {brandFilter !== '__non_branded__' && (
                    <>
                      {(brandFilter === '__branded__' || brandFilter === 'all') && (
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
                </SelectContent>
              </Select>
              
              <Select value={colorFilter} onValueChange={(value: any) => setColorFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Colors" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Colors</SelectItem>
                  {availableColors.map(color => {
                    const productCount = products.filter(p => 
                      (p as any).color && (p as any).color?.toLowerCase() === color.toLowerCase()
                    ).length;
                    return (
                      <SelectItem key={color} value={color}>
                        {color} {productCount > 0 && `(${productCount})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <Select value={shapeFilter} onValueChange={(value: any) => setShapeFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Shapes" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Shapes</SelectItem>
                  {availableShapes.map(shape => {
                    const productCount = products.filter(p => 
                      (p as any).shape && (p as any).shape?.toLowerCase() === shape.toLowerCase()
                    ).length;
                    return (
                      <SelectItem key={shape} value={shape}>
                        {shape} {productCount > 0 && `(${productCount})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <Select value={sizeFilter} onValueChange={(value: any) => setSizeFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Sizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {availableSizes.map(size => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={frameMaterialFilter} onValueChange={(value: any) => setFrameMaterialFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Materials" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Materials</SelectItem>
                  {availableFrameMaterials.map(material => {
                    const productCount = products.filter(p => 
                      (p as any).frame_material && (p as any).frame_material?.toLowerCase() === material.toLowerCase()
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
        </CardContent>
      </Card>

      {/* Products Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6' : 'space-y-4'}>
              {(() => {
          console.log('Rendering products:', products.length, 'items');
          const product42 = products.find(p => p.id === 42);
          if (product42) {
            console.log('Product 42 being rendered:', product42.name, product42.description);
          }
          return products
            .filter(product => {
              const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   product.description.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesCategory = categoryFilter === 'all' || 
                                    (product as any).category_id?.toString() === categoryFilter;
              // Helper function to normalize values for comparison
              const normalize = (value: any): string => {
                if (value === null || value === undefined) return '';
                return value.toString().trim().toLowerCase();
              };
              
              // Helper function to check if value matches in field, name, or description
              const matchesInFieldOrDescription = (fieldValue: any, filterValue: string, productName: string = '', description: string = ''): boolean => {
                if (filterValue === 'all') return true;
                const normalizedFilter = normalize(filterValue);
                const normalizedField = normalize(fieldValue);
                const normalizedName = normalize(productName);
                const normalizedDescription = normalize(description);
                
                // Check if it matches the field value exactly
                if (normalizedField && normalizedField === normalizedFilter) return true;
                
                // Check if it appears in the product name
                if (normalizedName && normalizedName.includes(normalizedFilter)) return true;
                
                // Check if it appears in the description
                if (normalizedDescription && normalizedDescription.includes(normalizedFilter)) return true;
                
                return false;
              };
              
              const matchesGender = genderFilter === 'all' || 
                                   normalize((product as any).gender) === normalize(genderFilter);
              
              const matchesColor = matchesInFieldOrDescription(
                (product as any).color,
                colorFilter,
                product.name || '',
                product.description || ''
              );
              
              // Brand filter: handle Branded / Non-Branded & specific brands similarly to public gallery
              let matchesBrand = true;
              if (brandFilter !== 'all') {
                if (brandFilter === '__non_branded__') {
                  const hasNoBrandField = !product.brand || product.brand.trim() === '';

                  // Fallback using image filename for sunglasses category
                  let isNonBrandedByFilename = false;
                  const categoryName = (product as any).category?.name?.toLowerCase() || '';
                  if (categoryName.includes('sunglass')) {
                    const imagePaths: string[] =
                      ((product as any).image_paths as string[]) || [];
                    const allPaths = Array.isArray(imagePaths) ? imagePaths : [];
                    isNonBrandedByFilename = allPaths.some((p) =>
                      p.toLowerCase().includes('nonbranded'),
                    );
                  }

                  matchesBrand = hasNoBrandField || isNonBrandedByFilename;
                } else if (brandFilter === '__branded__') {
                  const hasBrandField = product.brand && product.brand.trim() !== '';
                  matchesBrand = !!hasBrandField;
                } else {
                  matchesBrand = matchesInFieldOrDescription(
                    product.brand,
                    brandFilter,
                    product.name || '',
                    product.description || '',
                  );
                }
              }
              
              const matchesShape = matchesInFieldOrDescription(
                (product as any).shape,
                shapeFilter,
                product.name || '',
                product.description || ''
              );
              
              const productSize = (product as any).size || (product as any).frame_size;
              const matchesSize = matchesInFieldOrDescription(
                productSize,
                sizeFilter,
                product.name || '',
                product.description || ''
              );
              
              const matchesFrameMaterial = matchesInFieldOrDescription(
                (product as any).frame_material,
                frameMaterialFilter,
                product.name || '',
                product.description || ''
              );
              return matchesSearch && matchesCategory && matchesGender && matchesColor && matchesBrand && matchesShape && matchesSize && matchesFrameMaterial && !deletedProductIds.has(product.id);
            })
            .map(product => (
              viewMode === 'grid' ? (
                // Grid View Card
                <Card key={`product-grid-${product.id}-${refreshTrigger}-${product.price}-${product.name}`} className="group hover:shadow-lg transition-all duration-200 h-full flex flex-col border border-gray-200 hover:border-gray-300">
                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Product Image */}
                    <div className="aspect-[4/3] bg-gray-50 rounded-t-lg overflow-hidden relative">
                      {product.primary_image || (product.image_paths && product.image_paths[0]) ? (
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={getStorageUrl(product.primary_image || product.image_paths[0])}
                          alt={product.name}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `data:image/svg+xml;base64,${btoa(`
                              <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                                <rect width="100%" height="100%" fill="#f9fafb"/>
                                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle" dy=".3em">
                                  ${product.name}
                                </text>
                              </svg>
                            `)}`;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                          <Package className="w-16 h-16 opacity-50" />
                        </div>
                      )}
                  
                      {/* Status Badge - Clickable */}
                      <div 
                        className="absolute top-2 right-2 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Badge clicked for product:', product.id, 'current status:', product.is_active);
                          alert(`Clicked badge for product ${product.id}, current status: ${product.is_active}`);
                          handleToggleStatus(e, product);
                        }}
                        title={`Click to ${product.is_active ? 'deactivate' : 'activate'} product`}
                      >
                        <Badge 
                          variant={product.is_active ? 'default' : 'secondary'}
                          className={`text-xs px-2 py-1 hover:opacity-80 transition-opacity ${
                            product.is_active
                              ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-4 flex flex-col flex-grow">
                      {/* Product Name */}
                      <h3 className="font-semibold text-lg text-gray-900 line-clamp-2 mb-2 leading-tight">
                        {product.name}
                        {product.id === 42 && <span className="text-xs text-blue-500 ml-2">(ID: {product.id})</span>}
                      </h3>
                      
                      {/* Description */}
                      {product.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                      
                      {/* Gender and Lens Type Badges */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(product as any).gender && (
                          <Badge variant="outline" className="text-xs">
                            {(product as any).gender === 'men' ? "Men's" : 
                             (product as any).gender === 'women' ? "Women's" : 
                             (product as any).gender === 'kids' ? "Kids" : 
                             (product as any).gender === 'unisex' ? "Unisex" : 
                             (product as any).gender}
                          </Badge>
                        )}
                        {(product as any).lens_type && (
                          <Badge variant="outline" className="text-xs">
                            {(product as any).lens_type.split('_').map((word: string) => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </Badge>
                        )}
                        {(product as any).category && (
                          <Badge variant="secondary" className="text-xs">
                            {(product as any).category.name}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Price and Stock */}
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-blue-600">
                            ₱{Number(product.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                          <Package className="w-4 h-4" />
                          <span className="font-medium">
                            {(product as any).total_stock || product.stock_quantity || 0}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="mt-auto space-y-2">
                        {/* Primary Actions */}
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(e, product);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 hover:border-blue-300 transition-colors"
                            title={`Edit ${product.name}`}
                            type="button"
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={(e) => {
                              console.log('Button clicked (grid view) for product:', product.id);
                              handleToggleStatus(e, product);
                            }}
                            variant="outline"
                            size="sm"
                            className={`flex-1 ${
                              product.is_active 
                                ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 hover:border-orange-300' 
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 hover:border-green-300'
                            }`}
                            title={product.is_active ? 'Deactivate Product' : 'Activate Product'}
                          >
                            {product.is_active ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                            {product.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>

                        {/* Secondary Actions */}
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => handleManageStock(e, product)}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 hover:border-green-300"
                            title="Manage Stock"
                          >
                            <Building2 className="w-4 h-4 mr-1" />
                            Stock
                          </Button>
                          <Button
                            onClick={(e) => handleDelete(e, product.id)}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // List View Card
                <Card key={`product-list-${product.id}-${refreshTrigger}-${product.price}-${product.name}`} className="group hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-gray-300">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Product Image - Smaller in list view */}
                      <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden relative flex-shrink-0">
                        {product.primary_image || (product.image_paths && product.image_paths[0]) ? (
                          <img
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            src={getStorageUrl(product.primary_image || product.image_paths[0])}
                            alt={product.name}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `data:image/svg+xml;base64,${btoa(`
                                <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="100%" height="100%" fill="#f9fafb"/>
                                  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="10" fill="#6b7280" text-anchor="middle" dy=".3em">
                                    ${product.name}
                                  </text>
                                </svg>
                              `)}`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                            <Package className="w-8 h-8 opacity-50" />
                          </div>
                        )}
                        
                        {/* Status Badge - Clickable */}
                        <div 
                          className="absolute -top-1 -right-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Badge clicked for product:', product.id, 'current status:', product.is_active);
                            alert(`Clicked badge for product ${product.id}, current status: ${product.is_active}`);
                            handleToggleStatus(e, product);
                          }}
                          title={`Click to ${product.is_active ? 'deactivate' : 'activate'} product`}
                        >
                          <Badge 
                            variant={product.is_active ? 'default' : 'secondary'}
                            className={`text-xs px-1.5 py-0.5 hover:opacity-80 transition-opacity ${
                              product.is_active
                                ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-gray-900 truncate mb-1">
                              {product.name}
                              {product.id === 42 && <span className="text-xs text-blue-500 ml-2">(ID: {product.id})</span>}
                            </h3>
                            {product.description && (
                              <p className="text-gray-600 text-sm line-clamp-1 mb-2">
                                {product.description}
                              </p>
                            )}
                            {/* Gender and Lens Type Badges */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(product as any).gender && (
                                <Badge variant="outline" className="text-xs">
                                  {(product as any).gender === 'men' ? "Men's" : 
                                   (product as any).gender === 'women' ? "Women's" : 
                                   (product as any).gender === 'kids' ? "Kids" : 
                                   (product as any).gender === 'unisex' ? "Unisex" : 
                                   (product as any).gender}
                                </Badge>
                              )}
                              {(product as any).lens_type && (
                                <Badge variant="outline" className="text-xs">
                                  {(product as any).lens_type.split('_').map((word: string) => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </Badge>
                              )}
                              {(product as any).category && (
                                <Badge variant="secondary" className="text-xs">
                                  {(product as any).category.name}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-lg font-bold text-blue-600">
                                ₱{Number(product.price || 0).toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                                <Package className="w-4 h-4" />
                                <span className="font-medium">
                                  {(product as any).total_stock || product.stock_quantity || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 ml-0 sm:ml-4 mt-2 sm:mt-0">
                            <Button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEdit(e, product);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 hover:border-blue-300 transition-colors"
                              title={`Edit ${product.name}`}
                              type="button"
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              onClick={(e) => {
                                console.log('Button clicked for product:', product.id);
                                handleToggleStatus(e, product);
                              }}
                              variant="outline"
                              size="sm"
                              className={`${
                                product.is_active 
                                  ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 hover:border-orange-300' 
                                  : 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 hover:border-green-300'
                              }`}
                              title={product.is_active ? 'Deactivate Product' : 'Activate Product'}
                            >
                              {product.is_active ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                              <span>{product.is_active ? 'Deactivate' : 'Activate'}</span>
                            </Button>
                            <Button
                              onClick={(e) => handleManageStock(e, product)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 hover:border-green-300"
                              title="Manage Stock"
                            >
                              <Building2 className="w-4 h-4 mr-1" />
                              <span>Stock</span>
                            </Button>
                            <Button
                              onClick={(e) => handleDelete(e, product.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ));
        })()}
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b">
              <div className="flex justify-between items-start gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words flex-1">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
                </h2>
                <Button
                  onClick={resetForm}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              </div>
              
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter product name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                  <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter product description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <Select 
                    value={formData.category_id || ''} 
                    onValueChange={(value) => {
                      console.log('Category changed to:', value);
                      setFormData({ ...formData, category_id: value });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category">
                        {formData.category_id && categories.length > 0
                          ? (categories.find(c => c.id.toString() === formData.category_id)?.name || 'Select category')
                          : 'Select category'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                        ))
                      ) : (
                        // Use a non-empty sentinel value to satisfy Radix Select requirements
                        <SelectItem value="__loading__" disabled>Loading categories...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <Select 
                    value={formData.gender || ''} 
                    onValueChange={(value) => {
                      const normalized = value === '__none__' ? '' : value;
                      setFormData({ ...formData, gender: normalized });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Use sentinel value instead of empty string to avoid Radix error */}
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="men">Men&apos;s</SelectItem>
                      <SelectItem value="women">Women&apos;s</SelectItem>
                      <SelectItem value="kids">Kids</SelectItem>
                      <SelectItem value="unisex">Unisex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lens/Frame Type</label>
                  <Select 
                    value={formData.lens_type || ''} 
                    onValueChange={(value) => {
                      const normalized = value === '__none__' ? '' : value;
                      setFormData({ ...formData, lens_type: normalized });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select lens/frame type" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Use sentinel value instead of empty string to avoid Radix error */}
                      <SelectItem value="__none__">None</SelectItem>
                      {loadingLensTypes ? (
                        <SelectItem value="__loading__" disabled>Loading lens types...</SelectItem>
                      ) : lensTypes.length > 0 ? (
                        lensTypes.map((lensType) => (
                          <SelectItem key={lensType.id} value={lensType.slug}>
                            {lensType.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="ordinary">Ordinary Lens</SelectItem>
                          <SelectItem value="anti_radiation">Anti-Radiation Lens</SelectItem>
                          <SelectItem value="photochromic">Photochromic Lens</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  </div>
                </div>

                {/* Product Images Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Product Images</h3>
                  
                  {/* Image Upload Button */}
                    <div className="mb-4">
                  <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    className="flex items-center gap-2"
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {selectedFiles.length > 0 ? 'Add More Images' : 'Select Images'}
                  </Button>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Upload up to 4 images. Supported formats: JPG, PNG, GIF (max 2MB each)
                  </p>
                </div>

                  {/* Image Reorderer for New Files */}
                  {selectedFiles.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 mb-2">New Images</h4>
                      <ImageReorderer
                        images={selectedFiles.map((file, index) => ({
                          file,
                          name: file.name,
                        size: file.size,
                        preview: URL.createObjectURL(file),
                        isPrimary: index === primaryImageIndex
                      }))}
                      onReorder={(reorderedImages) => {
                        const reorderedFiles = reorderedImages.map(img => img.file);
                        setSelectedFiles(reorderedFiles);
                      }}
                      onSetPrimary={(index) => setPrimaryImageIndex(index)}
                      onRemove={(index) => removeImage(index, false)}
                      />
                    </div>
                  )}

                {/* Existing Images */}
                  {existingImages.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 mb-2">Existing Images</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {existingImages.map((imagePath, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={getStorageUrl(imagePath)}
                            alt={`Product ${index + 1}`}
                            className={`w-full h-20 object-cover rounded border cursor-pointer ${
                              index === primaryImageIndex 
                                ? 'border-blue-500 ring-2 ring-blue-200' 
                                : 'border-gray-300'
                            }`}
                            onClick={() => setPrimaryImageIndex(index)}
                          />
                          {index === primaryImageIndex && (
                            <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                              <Eye className="w-3 h-3" />
                  </div>
                  )}
                          <button
                            type="button"
                            onClick={() => removeImage(index, true)}
                            className="absolute top-1 left-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                </div>
                      ))}
                  </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Click on an image to set it as primary
                    </p>
                  </div>
                )}
                </div>
                
                {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                    type="button"
                  variant="outline"
                    onClick={resetForm}
                  >
                    Cancel
                </Button>
                <Button
                    type="submit"
                  className="flex items-center gap-2"
                  >
                  <Save className="w-4 h-4" />
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {selectedProductForStock && (
        <StockManagementModal
          isOpen={showStockModal}
          onClose={() => {
            setShowStockModal(false);
            setSelectedProductForStock(null);
          }}
          product={selectedProductForStock}
          onSave={handleStockSave}
        />
      )}
    </div>
  );
};

export default AdminProductManagement;