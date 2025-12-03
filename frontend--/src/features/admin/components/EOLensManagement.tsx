import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Upload, Search, Grid3x3, List, RefreshCw, Pencil, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getEOLenses, createEOLens, updateEOLens, deleteEOLens, getEOLensStatistics, EOLens, EOLensFilters } from '@/services/eoLensApi';
import { useBranch } from '@/contexts/BranchContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { API_BASE_URL } from '@/config/api';
import { getStorageUrl } from '@/utils/imageUtils';

interface ProductCategory {
  id: number;
  name: string;
  slug: string;
}

const EOLensManagement: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const [lenses, setLenses] = useState<EOLens[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLens, setEditingLens] = useState<EOLens | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    description: '',
    base_curve: '',
    diameter: '',
    power: '',
    material: '',
    color: '',
    water_content: '',
    replacement_schedule: '',
    brand: '',
    manufacturer: '',
    unit_price: '',
    wholesale_price: '',
    retail_price: '',
    stock_quantity: '',
    min_stock_threshold: '5',
    branch_id: '',
    is_active: true,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [statistics, setStatistics] = useState<any>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  useEffect(() => {
    fetchLenses();
    fetchCategories();
    fetchStatistics();
  }, [selectedBranchId, stockFilter, searchTerm]);

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
        const categoriesArray = data.data || data.categories || (Array.isArray(data) ? data : []);
        setCategories(categoriesArray);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchLenses = async () => {
    try {
      setLoading(true);
      const branchIdFilter =
        selectedBranchId && selectedBranchId !== 'all'
          ? Number(selectedBranchId)
          : undefined;

      const filters: EOLensFilters = {
        branch_id: branchIdFilter,
        stock_status: stockFilter !== 'all' ? stockFilter : undefined,
        search: searchTerm || undefined,
        per_page: 15,
      };

      const response = await getEOLenses(filters);
      setLenses(response.data || []);
      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (error: any) {
      console.error('Error fetching EO lenses:', error);
      toast.error('Failed to fetch EO lenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const stats = await getEOLensStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const lensData: any = {
        name: formData.name,
        sku: formData.sku,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        description: formData.description || undefined,
        base_curve: formData.base_curve ? parseFloat(formData.base_curve) : undefined,
        diameter: formData.diameter ? parseFloat(formData.diameter) : undefined,
        power: formData.power ? parseFloat(formData.power) : undefined,
        material: formData.material || undefined,
        color: formData.color || undefined,
        water_content: formData.water_content ? parseInt(formData.water_content) : undefined,
        replacement_schedule: formData.replacement_schedule || undefined,
        brand: formData.brand || undefined,
        manufacturer: formData.manufacturer || undefined,
        unit_price: parseFloat(formData.unit_price),
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : undefined,
        retail_price: formData.retail_price ? parseFloat(formData.retail_price) : undefined,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : 0,
        min_stock_threshold: parseInt(formData.min_stock_threshold || '5'),
        branch_id: formData.branch_id ? parseInt(formData.branch_id) : undefined,
        is_active: formData.is_active,
        images: selectedFiles.length > 0 ? selectedFiles : undefined,
      };

      if (editingLens) {
        await updateEOLens(editingLens.id, lensData);
        toast.success('EO lens updated successfully');
      } else {
        await createEOLens(lensData);
        toast.success('EO lens created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchLenses();
      fetchStatistics();
    } catch (error: any) {
      console.error('Error saving EO lens:', error);
      toast.error(error.response?.data?.message || 'Failed to save EO lens');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this EO lens?')) return;

    try {
      await deleteEOLens(id);
      toast.success('EO lens deleted successfully');
      fetchLenses();
      fetchStatistics();
    } catch (error: any) {
      console.error('Error deleting EO lens:', error);
      toast.error('Failed to delete EO lens');
    }
  };

  const handleEdit = (lens: EOLens) => {
    setEditingLens(lens);
    setFormData({
      name: lens.name,
      sku: lens.sku,
      category_id: lens.category_id?.toString() || '',
      description: lens.description || '',
      base_curve: lens.base_curve?.toString() || '',
      diameter: lens.diameter?.toString() || '',
      power: lens.power?.toString() || '',
      material: lens.material || '',
      color: lens.color || '',
      water_content: lens.water_content?.toString() || '',
      replacement_schedule: lens.replacement_schedule || '',
      brand: lens.brand || '',
      manufacturer: lens.manufacturer || '',
      unit_price: lens.unit_price.toString(),
      wholesale_price: lens.wholesale_price?.toString() || '',
      retail_price: lens.retail_price?.toString() || lens.unit_price.toString(),
      stock_quantity: lens.stock_quantity.toString(),
      min_stock_threshold: lens.min_stock_threshold.toString(),
      branch_id: lens.branch_id?.toString() || '',
      is_active: lens.is_active,
    });
    setExistingImages(lens.image_paths || []);
    setSelectedFiles([]);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category_id: '',
      description: '',
      base_curve: '',
      diameter: '',
      power: '',
      material: '',
      color: '',
      water_content: '',
      replacement_schedule: '',
      brand: '',
      manufacturer: '',
      unit_price: '',
      wholesale_price: '',
      retail_price: '',
      stock_quantity: '',
      min_stock_threshold: '5',
      branch_id: '',
      is_active: true,
    });
    setEditingLens(null);
    setSelectedFiles([]);
    setExistingImages([]);
  };

  const getStockStatus = (lens: EOLens) => {
    if (lens.stock_quantity <= 0) return { label: 'Out of Stock', color: 'destructive' };
    if (lens.stock_quantity <= lens.min_stock_threshold) return { label: 'Low Stock', color: 'warning' };
    return { label: 'In Stock', color: 'default' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">EO Lens Management</h1>
          <p className="text-muted-foreground">Manage your EO lenses inventory</p>
        </div>
        <Dialog open={showModal} onOpenChange={(open) => {
          setShowModal(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setShowModal(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add EO Lens
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLens ? 'Edit EO Lens' : 'Add New EO Lens'}</DialogTitle>
              <DialogDescription>
                {editingLens ? 'Update the EO lens information' : 'Add a new EO lens to your inventory'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
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
                  <Label htmlFor="category_id">Product Category</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="replacement_schedule">Replacement Schedule</Label>
                  <Select value={formData.replacement_schedule} onValueChange={(value) => setFormData({ ...formData, replacement_schedule: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="base_curve">Base Curve (BC)</Label>
                  <Input
                    id="base_curve"
                    type="number"
                    step="0.01"
                    value={formData.base_curve}
                    onChange={(e) => setFormData({ ...formData, base_curve: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="diameter">Diameter (DIA)</Label>
                  <Input
                    id="diameter"
                    type="number"
                    step="0.01"
                    value={formData.diameter}
                    onChange={(e) => setFormData({ ...formData, diameter: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="power">Power</Label>
                  <Input
                    id="power"
                    type="number"
                    step="0.01"
                    value={formData.power}
                    onChange={(e) => setFormData({ ...formData, power: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Input
                    id="material"
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="water_content">Water Content (%)</Label>
                  <Input
                    id="water_content"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.water_content}
                    onChange={(e) => setFormData({ ...formData, water_content: e.target.value })}
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
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="unit_price">Unit Price *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="wholesale_price">Wholesale Price</Label>
                  <Input
                    id="wholesale_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="retail_price">Retail Price</Label>
                  <Input
                    id="retail_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.retail_price}
                    onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stock_quantity">Stock Quantity</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="min_stock_threshold">Min Stock Threshold</Label>
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
                <Label htmlFor="images">Images</Label>
                <Input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles(files);
                  }}
                />
                {existingImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {existingImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={getStorageUrl(img)} alt={`Existing ${idx + 1}`} className="w-full h-20 object-cover rounded" />
                      </div>
                    ))}
                  </div>
                )}
                {selectedFiles.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {selectedFiles.length} file(s) selected
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingLens ? 'Update' : 'Create'} EO Lens
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {statistics && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Lenses</CardDescription>
              <CardTitle className="text-2xl">{statistics.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-2xl">{statistics.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Stock</CardDescription>
              <CardTitle className="text-2xl">{statistics.in_stock}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Low Stock</CardDescription>
              <CardTitle className="text-2xl text-orange-600">{statistics.low_stock}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Out of Stock</CardDescription>
              <CardTitle className="text-2xl text-red-600">{statistics.out_of_stock}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>EO Lenses</CardTitle>
              <CardDescription>Manage your EO lens inventory</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={fetchLenses}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={stockFilter}
              onValueChange={(value) =>
                setStockFilter(
                  value as 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
                )
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : lenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No EO lenses found</div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lenses.map((lens) => {
                const stockStatus = getStockStatus(lens);
                return (
                  <Card key={lens.id} className="overflow-hidden">
                    <div className="aspect-video bg-muted relative">
                      {lens.image_paths && lens.image_paths.length > 0 ? (
                        <img
                          src={getStorageUrl(lens.image_paths[0])}
                          alt={lens.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2" variant={stockStatus.color as any}>
                        {stockStatus.label}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1">{lens.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">SKU: {lens.sku}</p>
                      {lens.category && (
                        <Badge variant="outline" className="mb-2">{lens.category.name}</Badge>
                      )}
                      <div className="flex justify-between items-center mt-4">
                        <span className="font-bold">₱{lens.retail_price?.toFixed(2) || lens.unit_price.toFixed(2)}</span>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(lens)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(lens.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Stock: {lens.stock_quantity} units
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {lenses.map((lens) => {
                const stockStatus = getStockStatus(lens);
                return (
                  <Card key={lens.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                          {lens.image_paths && lens.image_paths.length > 0 ? (
                            <img
                              src={getStorageUrl(lens.image_paths[0])}
                              alt={lens.name}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{lens.name}</h3>
                          <p className="text-sm text-muted-foreground">SKU: {lens.sku}</p>
                          {lens.category && (
                            <Badge variant="outline" className="mt-1">{lens.category.name}</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₱{lens.retail_price?.toFixed(2) || lens.unit_price.toFixed(2)}</p>
                          <Badge variant={stockStatus.color as any} className="mt-1">
                            {stockStatus.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Stock: {lens.stock_quantity}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(lens)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(lens.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EOLensManagement;

