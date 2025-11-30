import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Edit, 
  Search, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Building,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

import { getApiUrl, getAuthHeaders } from '@/config/api';

interface InventoryItem {
  id: number;
  branch_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  brand?: string;
  model?: string;
  description?: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  min_threshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  price: number | string;
  price_override?: number | string | null;
  effective_price: number | string;
  expiry_date?: string;
  last_restock_date?: string;
  auto_restock_enabled: boolean;
  auto_restock_quantity?: number;
  is_active: boolean;
  images?: string[];
  primary_image?: string;
  branch: {
    id: number;
    name: string;
    code: string;
  };
  created_at: string;
  updated_at: string;
}

interface InventorySummary {
  total_items: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_value: number | string;
  branches_count: number;
}

const UnifiedStaffInventory: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState<InventoryItem | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnForm, setReturnForm] = useState({
    return_type: 'defective',
    quantity: '',
    reason: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    brand: '',
    model: '',
    price: '',
    stock_quantity: '',
    min_stock_threshold: '5',
    expiry_date: '',
  });

  // Set branch ID from user on mount and refresh user profile if needed
  useEffect(() => {
    const initializeBranch = async () => {
      // For staff users, use their assigned branch
      if (user?.branch?.id) {
        setSelectedBranchId(user.branch.id.toString());
        setLoading(false);
      } else {
        // If user has no branch but exists, try refreshing profile to get updated branch info
        if (user?.id && refreshUser) {
          console.log('User has no branch object, attempting to refresh profile...');
          try {
            await refreshUser();
            // After refresh, user state will update and this effect will run again
            // The updated user object from refreshUser will trigger a re-render
            return;
          } catch (error) {
            console.error('Error refreshing user profile:', error);
            setError('No branch assigned to your account. Please log out and log back in, or contact an administrator.');
            setLoading(false);
          }
        } else {
          setError('No branch assigned to your account');
          setLoading(false);
        }
      }
    };

    initializeBranch();
  }, [user?.branch?.id, user?.id, refreshUser]);

  const loadInventory = useCallback(async () => {
    if (!selectedBranchId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem('auth_token');
      if (!token) {
        setError('You must be logged in to view inventory');
        setLoading(false);
        return;
      }

      const response = await axios.get(getApiUrl(`/inventory/enhanced?branch_id=${selectedBranchId}`), {
        headers: getAuthHeaders(),
      });

      // Handle response data
      if (response.data) {
        setInventory(Array.isArray(response.data.inventories) ? response.data.inventories : []);
        setSummary(response.data.summary || {
          total_items: 0,
          in_stock: 0,
          low_stock: 0,
          out_of_stock: 0,
          total_value: 0,
          branches_count: 0,
        });
      } else {
        setInventory([]);
        setSummary({
          total_items: 0,
          in_stock: 0,
          low_stock: 0,
          out_of_stock: 0,
          total_value: 0,
          branches_count: 0,
        });
      }
    } catch (err: any) {
      // Enhanced error logging
      console.error('Error loading inventory:', {
        error: err,
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        branchId: selectedBranchId,
      });
      
      // Extract error message safely
      let errorMessage = 'Failed to load inventory';
      if (err?.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (Array.isArray(err.response.data.errors)) {
          errorMessage = err.response.data.errors.join(', ');
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Set empty data on error
      setInventory([]);
      setSummary({
        total_items: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0,
        total_value: 0,
        branches_count: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadInventory();
    // Refresh every 30 seconds
    const interval = setInterval(loadInventory, 30000);
    return () => clearInterval(interval);
  }, [loadInventory]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranchId) {
      setError('Please select a branch first');
      return;
    }
    
    try {
      setError(null);
      
      const token = sessionStorage.getItem('auth_token');
      await axios.post(getApiUrl('/enhanced-inventory'), {
        branch_id: selectedBranchId,
        product_name: formData.name,
        sku: formData.sku,
        description: formData.description,
        brand: formData.brand,
        model: formData.model,
        unit_price: parseFloat(formData.price),
        quantity: parseInt(formData.stock_quantity),
        min_threshold: parseInt(formData.min_stock_threshold),
        expiry_date: formData.expiry_date || null,
      }, {
        headers: getAuthHeaders(),
      });

      setSuccess('Product added successfully!');
      setShowAddModal(false);
      resetForm();
      loadInventory();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error adding product:', err);
      setError(err.response?.data?.message || 'Failed to add product');
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    try {
      setError(null);
      
      const payload: any = {
        quantity: parseInt(formData.stock_quantity),
        min_threshold: parseInt(formData.min_stock_threshold),
      };
      
      // Only include unit_price if it has a value
      if (formData.price && formData.price.trim() !== '') {
        payload.unit_price = parseFloat(formData.price);
      }
      
      // Only include expiry_date if it has a value
      if (formData.expiry_date && formData.expiry_date.trim() !== '') {
        payload.expiry_date = formData.expiry_date;
      }
      
      console.log('Updating inventory with payload:', payload);
      
      const token = sessionStorage.getItem('auth_token');
      await axios.put(getApiUrl(`/enhanced-inventory/${selectedItem.id}`), payload, {
        headers: getAuthHeaders(),
      });

      setSuccess('Inventory updated successfully!');
      setShowEditModal(false);
      setSelectedItem(null);
      resetForm();
      loadInventory();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating inventory:', err);
      console.error('Full error response:', err.response?.data);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to update inventory';
      setError(errorMsg);
    }
  };

  const handleToggleStatus = async (item: InventoryItem) => {
    try {
      setError(null);
      
      const newStatus = !item.is_active;
      
      // Optimistic update
      setInventory(prevInventory =>
        prevInventory.map(i =>
          i.id === item.id ? { ...i, is_active: newStatus } : i
        )
      );

      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(getApiUrl(`/products/${item.product_id}`), {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          is_active: newStatus
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update product' }));
        throw new Error(errorData.message || 'Failed to update product');
      }

      setSuccess(`Product ${newStatus ? 'activated' : 'deactivated'} successfully!`);
      loadInventory();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error toggling status:', err);
      // Revert optimistic update on error
      setInventory(prevInventory =>
        prevInventory.map(i =>
          i.id === item.id ? { ...i, is_active: !item.is_active } : i
        )
      );
      setError(err.response?.data?.message || err.message || 'Failed to update product status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      brand: '',
      model: '',
      price: '',
      stock_quantity: '',
      min_stock_threshold: '5',
      expiry_date: '',
    });
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.product_name,
      sku: item.sku,
      description: item.description || '',
      brand: item.brand || '',
      model: item.model || '',
      price: (item.price_override || item.price).toString(),
      stock_quantity: item.stock_quantity.toString(),
      min_stock_threshold: item.min_threshold.toString(),
      expiry_date: item.expiry_date || '',
    });
    setShowEditModal(true);
  };

  const openReturnModal = (item: InventoryItem) => {
    setReturnItem(item);
    setReturnForm({
      return_type: 'defective',
      quantity: '1',
      reason: '',
    });
    setShowReturnModal(true);
  };

  const handleCreateStockReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!returnItem) {
      setError('No inventory item selected for stock return');
      return;
    }

    const branchIdForReturn =
      selectedBranchId || (user?.branch?.id ? String(user.branch.id) : '');

    if (!branchIdForReturn) {
      setError('No branch selected for stock return');
      return;
    }

    const quantity = parseInt(returnForm.quantity, 10) || 0;

    if (quantity < 1) {
      setError('Return quantity must be at least 1');
      return;
    }

    // Ensure we don't return more than is available
    if (quantity > returnItem.available_quantity) {
      setError('Return quantity cannot exceed available quantity');
      return;
    }

    try {
      setReturnSubmitting(true);
      setError(null);

      await axios.post(
        getApiUrl('/stock-returns'),
        {
          product_id: returnItem.product_id,
          branch_id: Number(branchIdForReturn),
          return_type: returnForm.return_type,
          quantity,
          reason:
            returnForm.reason && returnForm.reason.trim().length > 0
              ? returnForm.reason.trim()
              : `${returnForm.return_type} stock return from inventory`,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      setSuccess('Stock return request submitted for approval');
      setShowReturnModal(false);
      setReturnItem(null);
      setReturnForm({
        return_type: 'defective',
        quantity: '',
        reason: '',
      });

      // Refresh inventory in case future logic adjusts stock on approval
      loadInventory();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error creating stock return:', err);
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to create stock return request';
      setError(errorMsg);
    } finally {
      setReturnSubmitting(false);
    }
  };


  // Filter inventory based on search and status
  const filteredInventory = useMemo(() => {
    console.log('Filtering inventory:', {
      totalItems: inventory.length,
      statusFilter,
      searchTerm,
      uniqueStatuses: [...new Set(inventory.map(i => i.status))]
    });
    
    const filtered = inventory.filter(item => {
      const matchesSearch = searchTerm === '' || 
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Normalize status comparison to handle both formats
      const itemStatus = item.status?.toLowerCase().replace(/\s+/g, '_');
      const filterStatus = statusFilter.toLowerCase().replace(/\s+/g, '_');
      const matchesStatus = statusFilter === 'all' || itemStatus === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
    
    console.log('Filtered results:', filtered.length, 'items with status filter:', statusFilter);
    return filtered;
  }, [inventory, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />In Stock</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" />Low Stock</Badge>;
      case 'out_of_stock':
        return <Badge className="bg-red-500"><AlertTriangle className="h-3 w-3 mr-1" />Out of Stock</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading && !inventory.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Branch Inventory Management</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2">
            {user?.branch?.name ? `Managing inventory for ${user.branch.name}` : 'Manage products for your branch'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
          <Button 
            onClick={loadInventory} 
            variant="outline" 
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={() => { resetForm(); setShowAddModal(true); }} 
            className="gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_items}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Stock</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.in_stock}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.low_stock}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.out_of_stock}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱{Number(summary.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name, SKU, brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="w-48">
            <Label htmlFor="status">Status Filter</Label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items ({filteredInventory.length})</CardTitle>
          <CardDescription>
            Products available in your branch
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">SKU</th>
                  <th className="text-left p-2">Brand/Model</th>
                  <th className="text-right p-2">Stock</th>
                  <th className="text-right p-2">Available</th>
                  <th className="text-right p-2">Min. Threshold</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-center p-2">Status</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`border-b hover:bg-muted/50 ${!item.is_active ? 'opacity-60 bg-gray-50' : ''}`}
                    >
                      <td className="p-2 font-medium">
                        <div className="flex items-center gap-2">
                          {item.product_name}
                          {!item.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">{item.sku}</td>
                      <td className="p-2 text-sm">
                        {item.brand && item.model ? `${item.brand} - ${item.model}` : item.brand || item.model || '-'}
                      </td>
                      <td className="p-2 text-right">{item.stock_quantity}</td>
                      <td className="p-2 text-right font-medium">{item.available_quantity}</td>
                      <td className="p-2 text-right text-muted-foreground">{item.min_threshold}</td>
                      <td className="p-2 text-right">₱{Number(item.effective_price || 0).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(item.status)}
                          {!item.is_active && (
                            <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReturnModal(item)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Create stock return (defective/damaged)"
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Return
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(item)}
                            className={
                              item.is_active
                                ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            }
                            title={item.is_active ? 'Deactivate Product' : 'Activate Product'}
                          >
                            {item.is_active ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Add a new product to your branch inventory
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProduct}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="min_stock_threshold">Min. Threshold</Label>
                  <Input
                    id="min_stock_threshold"
                    type="number"
                    min="0"
                    value={formData.min_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, min_stock_threshold: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit">Add Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>
              Update stock quantity and settings for {selectedItem?.product_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateStock}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="edit_stock_quantity">Stock Quantity *</Label>
                <Input
                  id="edit_stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_min_threshold">Min. Threshold</Label>
                <Input
                  id="edit_min_threshold"
                  type="number"
                  min="0"
                  value={formData.min_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, min_stock_threshold: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_price">Price Override (Optional)</Label>
                <Input
                  id="edit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_expiry_date">Expiry Date (Optional)</Label>
                <Input
                  id="edit_expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowEditModal(false); setSelectedItem(null); }}>
                Cancel
              </Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Return Modal */}
      <Dialog
        open={showReturnModal}
        onOpenChange={(open) => {
          setShowReturnModal(open);
          if (!open) {
            setReturnItem(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Stock Return
              {returnItem ? ` - ${returnItem.product_name}` : ''}
            </DialogTitle>
            <DialogDescription>
              Record a stock return for defective or damaged items. This will
              create a request for admin review and approval.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStockReturn}>
            <div className="grid gap-4 py-4">
              {returnItem && (
                <div className="text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium">SKU:</span> {returnItem.sku}
                  </p>
                  <p>
                    <span className="font-medium">Available:</span>{' '}
                    {returnItem.available_quantity}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="return_type">Return Type *</Label>
                  <select
                    id="return_type"
                    value={returnForm.return_type}
                    onChange={(e) =>
                      setReturnForm((prev) => ({
                        ...prev,
                        return_type: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    required
                  >
                    <option value="defective">Defective</option>
                    <option value="damaged">Damaged</option>
                    <option value="expired">Expired</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="return_quantity">Quantity *</Label>
                  <Input
                    id="return_quantity"
                    type="number"
                    min={1}
                    value={returnForm.quantity}
                    onChange={(e) =>
                      setReturnForm((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="return_reason">Reason *</Label>
                <Textarea
                  id="return_reason"
                  value={returnForm.reason}
                  onChange={(e) =>
                    setReturnForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Describe the issue with the returned items (e.g., lenses scratched on arrival, frame broken during fitting)."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnItem(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={returnSubmitting}>
                {returnSubmitting ? 'Submitting...' : 'Submit Return'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default UnifiedStaffInventory;

