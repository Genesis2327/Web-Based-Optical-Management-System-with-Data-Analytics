import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Upload, Save, X, Package, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getStaffProducts } from '@/services/staffProductApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getApiUrl } from '@/config/api';
import { getLensTypes, LensType } from '@/services/lensTypeApi';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_paths: string[];
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_by: number;
  created_by_role: string;
  branch_id: number;
  created_at: string;
  creator: {
    id: number;
    name: string;
    email: string;
  };
  branch: {
    id: number;
    name: string;
    code: string;
  };
}

const StaffProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock_quantity: '',
    category_id: '',
    gender: '',
    lens_type: '',
    is_active: true
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lensTypes, setLensTypes] = useState<LensType[]>([]);
  const [loadingLensTypes, setLoadingLensTypes] = useState(false);

  const getStorageUrl = (path: string) => {
    const apiBaseUrl = getApiUrl('/');
    const baseUrl = apiBaseUrl.replace('/api', '');
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${baseUrl}/storage/${cleanPath}`;
  };

  // Fetch lens types on component mount
  useEffect(() => {
    const fetchLensTypes = async () => {
      try {
        setLoadingLensTypes(true);
        const types = await getLensTypes(true); // Get only active lens types
        setLensTypes(types);
      } catch (error) {
        console.error('Failed to fetch lens types:', error);
        // Fallback to default lens types if API fails
        setLensTypes([
          { id: 1, name: 'Ordinary Lens', slug: 'ordinary', base_price: 0, is_active: true } as LensType,
          { id: 2, name: 'Anti-Radiation Lens', slug: 'anti_radiation', base_price: 0, is_active: true } as LensType,
          { id: 3, name: 'Photochromic Lens', slug: 'photochromic', base_price: 0, is_active: true } as LensType,
        ]);
      } finally {
        setLoadingLensTypes(false);
      }
    };
    fetchLensTypes();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedStatus]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getStaffProducts({
        approval_status: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: searchTerm || undefined
      });
      
      setProducts(data.products || []);
      setStats({
        total: data.total_count || 0,
        approved: data.approved_count || 0,
        pending: data.pending_count || 0,
        rejected: data.rejected_count || 0
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (!formData.price || parseFloat(formData.price) < 0) {
      toast.error('Valid price is required');
      return;
    }
    
    if (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0) {
      toast.error('Valid stock quantity is required');
      return;
    }
    
    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('description', formData.description.trim());
      fd.append('price', parseFloat(formData.price).toString());
      fd.append('stock_quantity', parseInt(formData.stock_quantity).toString());
      fd.append('is_active', formData.is_active.toString());
      if (formData.category_id) {
        fd.append('category_id', formData.category_id);
      }
      if (formData.gender && formData.gender !== '') {
        fd.append('gender', formData.gender);
      }
      if (formData.lens_type && formData.lens_type !== '') {
        fd.append('lens_type', formData.lens_type);
      }
      
      // Append images
      selectedFiles.forEach((file, index) => {
        fd.append(`images[${index}]`, file);
      });

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
        body: fd,
      });

      if (response.ok) {
        toast.success('Product created successfully. Awaiting admin approval.');
        setShowModal(false);
        resetForm();
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create product');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to create product');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct) return;
    
    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('description', formData.description.trim());
      fd.append('price', parseFloat(formData.price).toString());
      fd.append('stock_quantity', parseInt(formData.stock_quantity).toString());
      fd.append('is_active', formData.is_active.toString());
      fd.append('_method', 'PUT');
      
      // Append new images
      selectedFiles.forEach((file, index) => {
        fd.append(`images[${index}]`, file);
      });

      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
        body: fd,
      });

      if (response.ok) {
        toast.success('Product updated successfully');
        setShowModal(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        toast.success('Product deleted successfully');
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      stock_quantity: '',
      category_id: '',
      gender: '',
      lens_type: '',
      is_active: true
    });
    setSelectedFiles([]);
    setEditingProduct(null);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      category_id: (product as any).category_id?.toString() || '',
      gender: (product as any).gender || '',
      lens_type: (product as any).lens_type || '',
      is_active: product.is_active
    });
    setSelectedFiles([]);
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="staff-product-management-container space-y-6">
      <style>{`
        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */
        
        @media (max-width: 319px) {
          .staff-product-management-container {
            padding: 0.5rem;
          }
        }
        
        @media (min-width: 320px) and (max-width: 480px) {
          .staff-product-management-container {
            padding: 0.75rem;
          }
          .staff-product-management-container h1 {
            font-size: 1.5rem;
          }
        }
        
        @media (min-width: 481px) and (max-width: 767px) {
          .staff-product-management-container {
            padding: 1rem;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1024px) {
          .staff-product-management-container {
            padding: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) and (max-width: 1280px) {
          .staff-product-management-container {
            padding: 2rem;
          }
        }
        
        @media (min-width: 1281px) and (max-width: 1919px) {
          .staff-product-management-container {
            padding: 2.5rem;
          }
        }
        
        @media (min-width: 1920px) {
          .staff-product-management-container {
            padding: 3rem;
          }
        }
        
        @media (orientation: landscape) and (max-height: 600px) {
          .staff-product-management-container {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
        }
        
        @media (hover: none) and (pointer: coarse) {
          .staff-product-management-container * {
            min-height: 44px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .staff-product-management-container * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        @media (max-width: 640px) {
          .staff-product-management-container .max-w-7xl {
            max-width: 100%;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
        }
      `}</style>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-600 mt-2">Manage products for your branch</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Products</Label>
              <Input
                id="search"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="md:w-48">
              <Label htmlFor="status">Status Filter</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Products ({filteredProducts.length})</CardTitle>
          <CardDescription>Products uploaded by you for your branch</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No products found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        {getStatusBadge(product.approval_status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><span className="font-medium">Price:</span> ₱{product.price.toFixed(2)}</p>
                          <p><span className="font-medium">Stock:</span> {product.stock_quantity}</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Status:</span> {product.is_active ? 'Active' : 'Inactive'}</p>
                          <p><span className="font-medium">Date:</span> {new Date(product.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-sm text-gray-600 mt-2">{product.description}</p>
                      )}

                      {product.image_paths && product.image_paths.length > 0 && (
                        <div className="mt-3">
                          <div className="flex gap-2">
                            {product.image_paths.slice(0, 3).map((image, index) => (
                              <img
                                key={index}
                                src={getStorageUrl(image)}
                                alt={`${product.name} ${index + 1}`}
                                className="w-16 h-16 object-cover rounded border"
                              />
                            ))}
                            {product.image_paths.length > 3 && (
                              <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-500">
                                +{product.image_paths.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {product.approval_status === 'pending' && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                            <p className="text-sm text-yellow-800">
                              This product is pending admin approval and is not visible to customers.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        onClick={() => openEditModal(product)}
                        variant="outline"
                        size="sm"
                        disabled={product.approval_status === 'rejected'}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(product.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Product Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product information' : 'Create a new product for your branch. It will be marked as pending until admin approval.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={editingProduct ? handleUpdate : handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender || ''}
                  onValueChange={(value) => {
                    const normalized = value === '__none__' ? '' : value;
                    setFormData({ ...formData, gender: normalized });
                  }}
                >
                  <SelectTrigger>
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
              <div>
                <Label htmlFor="lens_type">Lens/Frame Type</Label>
                <Select
                  value={formData.lens_type || ''}
                  onValueChange={(value) => {
                    const normalized = value === '__none__' ? '' : value;
                    setFormData({ ...formData, lens_type: normalized });
                  }}
                >
                  <SelectTrigger>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="images">Product Images (Max 4)</Label>
              <Input
                ref={fileInputRef}
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                className="mt-1"
              />
              {selectedFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Selected files: {selectedFiles.length}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowModal(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploadingImage}>
                {uploadingImage ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffProductManagement;
