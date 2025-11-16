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
  Trash2, 
  Search, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Building
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

import { getApiBaseUrlDynamic } from '@/config/api';
// Use dynamic API URL - recalculates based on current hostname
const getAPIUrl = () => getApiBaseUrlDynamic();

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
  const { user } = useAuth();
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
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

  // Set branch ID from user on mount
  useEffect(() => {
    // For staff users, use their assigned branch
    if (user?.branch?.id) {
      setSelectedBranchId(user.branch.id.toString());
      setLoading(false);
    } else {
      setError('No branch assigned to your account');
      setLoading(false);
    }
  }, [user?.branch?.id]);

  const loadInventory = useCallback(async () => {
    if (!selectedBranchId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem('auth_token');
      const response = await axios.get(`${getAPIUrl()}/inventory/enhanced?branch_id=${selectedBranchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setInventory(response.data.inventories || []);
      setSummary(response.data.summary || null);
    } catch (err: any) {
      console.error('Error loading inventory:', err);
      setError(err.response?.data?.message || 'Failed to load inventory');
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
      await axios.post(`${getAPIUrl()}/enhanced-inventory`, {
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
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
      await axios.put(`${getAPIUrl()}/enhanced-inventory/${selectedItem.id}`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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

  const handleDeleteProduct = async () => {
    if (!selectedItem) return;
    
    try {
      setError(null);
      
      const token = sessionStorage.getItem('auth_token');
      await axios.delete(`${getAPIUrl()}/enhanced-inventory/${selectedItem.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setSuccess('Product removed from inventory successfully!');
      setShowDeleteConfirm(false);
      setSelectedItem(null);
      loadInventory();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setError(err.response?.data?.message || 'Failed to delete product');
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

  const openDeleteConfirm = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branch Inventory Management</h1>
          <p className="text-muted-foreground mt-1">
            {user?.branch?.name ? `Managing inventory for ${user.branch.name}` : 'Manage products for your branch'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadInventory} 
            variant="outline" 
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={() => { resetForm(); setShowAddModal(true); }} 
            className="gap-2"
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
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{item.product_name}</td>
                      <td className="p-2 text-sm text-muted-foreground">{item.sku}</td>
                      <td className="p-2 text-sm">
                        {item.brand && item.model ? `${item.brand} - ${item.model}` : item.brand || item.model || '-'}
                      </td>
                      <td className="p-2 text-right">{item.stock_quantity}</td>
                      <td className="p-2 text-right font-medium">{item.available_quantity}</td>
                      <td className="p-2 text-right text-muted-foreground">{item.min_threshold}</td>
                      <td className="p-2 text-right">₱{Number(item.effective_price || 0).toFixed(2)}</td>
                      <td className="p-2 text-center">{getStatusBadge(item.status)}</td>
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
                            onClick={() => openDeleteConfirm(item)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{selectedItem?.product_name}" from your branch inventory?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowDeleteConfirm(false); setSelectedItem(null); }}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteProduct}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnifiedStaffInventory;

