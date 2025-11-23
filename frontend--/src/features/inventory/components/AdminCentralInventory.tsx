import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, 
  AlertTriangle, 
  Building, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  Users,
  Phone,
  Mail,
  Globe,
  MapPin,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Award,
  Clock,
  Store
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

import { getApiBaseUrlDynamic } from '@/config/api';
// Use dynamic API URL to support network access
const getAPI_BASE_URL = () => getApiBaseUrlDynamic();
const API_BASE_URL = getApiBaseUrlDynamic(); // Initialize at module load, but will be recalculated on each request

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  min_threshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  price: number;
  expiry_date?: string;
  last_restock_date?: string;
  product?: any;
}

interface BranchGroup {
  branch_id: string;
  branch: {
    id: string;
    name: string;
    code: string;
  };
  items: InventoryItem[];
  summary: {
    total_items: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
  };
}

interface Manufacturer {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  product_line: string;
  address?: string;
  website?: string;
  notes?: string;
}

interface Analytics {
  most_stocked_product?: {
    product_id: string;
    product_name: string;
    total_quantity: number;
  };
  low_stock_count: number;
  expiring_soon_count: number;
  highest_turnover_branch?: {
    branch_id: string;
    branch_name: string;
    total_value: number;
  };
}

const AdminCentralInventory: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Inventory state
  const [branchGroups, setBranchGroups] = useState<BranchGroup[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  
  // Manufacturer state
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedTab, setSelectedTab] = useState('inventory');
  
  // Manufacturer CRUD modals
  const [isManufacturerModalOpen, setIsManufacturerModalOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);
  const [manufacturerForm, setManufacturerForm] = useState<Partial<Manufacturer>>({});
  
  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
    loadInventory();
    loadManufacturers();
      loadAnalytics();
    
    const interval = setInterval(() => {
      loadInventory();
        loadAnalytics();
    }, 30000);
    
    return () => clearInterval(interval);
    }
  }, [user, searchTerm, statusFilter, branchFilter]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') {
        const dbStatus = statusFilter.replace('_', ' ');
        params.append('status', dbStatus);
      }
      if (branchFilter !== 'all') params.append('branch_id', branchFilter);

      const response = await axios.get(`${API_BASE_URL}/admin/central-inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
      });

      setBranchGroups(response.data.branches || []);
      setSummary(response.data.summary || {});
    } catch (err: any) {
      console.error('Error loading inventory:', err);
      setError((err as any).response?.data?.message || 'Failed to load inventory');
      toast({
        title: "Error",
        description: "Failed to load inventory data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadManufacturers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/manufacturers`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
      });
      setManufacturers(response.data.manufacturers || []);
    } catch (err: any) {
      console.error('Error loading manufacturers:', err);
      toast({
        title: "Error",
        description: "Failed to load manufacturers",
        variant: "destructive",
      });
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/central-inventory/analytics`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
      });
      setAnalytics(response.data);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
    }
  };

  const toggleBranch = (branchId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };

  const openManufacturerModal = (manufacturer?: Manufacturer) => {
    if (manufacturer) {
      setEditingManufacturer(manufacturer);
      setManufacturerForm(manufacturer);
    } else {
      setEditingManufacturer(null);
      setManufacturerForm({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        product_line: '',
        address: '',
        website: '',
        notes: '',
      });
    }
    setIsManufacturerModalOpen(true);
  };

  const closeManufacturerModal = () => {
    setIsManufacturerModalOpen(false);
    setEditingManufacturer(null);
    setManufacturerForm({});
  };

  const saveManufacturer = async () => {
    try {
      if (!manufacturerForm.name || !manufacturerForm.contact_person || 
          !manufacturerForm.email || !manufacturerForm.phone || !manufacturerForm.product_line) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      if (editingManufacturer) {
        await axios.put(`${API_BASE_URL}/admin/manufacturers/${editingManufacturer.id}`, manufacturerForm, {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          },
        });
        toast({
          title: "Success",
          description: "Manufacturer updated successfully",
        });
      } else {
        await axios.post(`${API_BASE_URL}/admin/manufacturers`, manufacturerForm, {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          },
        });
        toast({
          title: "Success",
          description: "Manufacturer created successfully",
        });
      }
      
      closeManufacturerModal();
      loadManufacturers();
    } catch (err: any) {
      console.error('Error saving manufacturer:', err);
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to save manufacturer",
        variant: "destructive",
      });
    }
  };

  const deleteManufacturer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this manufacturer?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/admin/manufacturers/${id}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
      });
      toast({
        title: "Success",
        description: "Manufacturer deleted successfully",
      });
      loadManufacturers();
    } catch (err: any) {
      console.error('Error deleting manufacturer:', err);
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete manufacturer",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    const normalized = status?.toLowerCase().replace(/\s+/g, '_');
    switch (normalized) {
      case 'in_stock':
        return 'bg-green-100 text-green-800';
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-800';
      case 'out_of_stock':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page. Admin access required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Central Inventory</h1>
              <p className="text-gray-600">Monitor inventory across all branches</p>
            </div>
          </div>
          <Button
            onClick={loadInventory}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_items || 0}</div>
              <p className="text-xs text-muted-foreground">Across {summary.total_branches || 0} branches</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Stock</CardTitle>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.in_stock || 0}</div>
              <p className="text-xs text-muted-foreground">Available items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.low_stock || 0}</div>
              <p className="text-xs text-muted-foreground">Need restocking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.out_of_stock || 0}</div>
              <p className="text-xs text-muted-foreground">Immediate attention needed</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Stocked Product</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {analytics.most_stocked_product?.product_name || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.most_stocked_product?.total_quantity || 0} units
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Count</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {analytics.low_stock_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">System-wide alerts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.expiring_soon_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">Next 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Highest Turnover</CardTitle>
                <Store className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {analytics.highest_turnover_branch?.branch_name || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  ₱{analytics.highest_turnover_branch?.total_value?.toLocaleString() || '0'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inventory">Inventory Overview</TabsTrigger>
            <TabsTrigger value="manufacturers">Manufacturer Directory</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="search">Search Items</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder="Search by name or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="min-w-[150px]">
                    <Label htmlFor="status">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="in_stock">In Stock</SelectItem>
                        <SelectItem value="low_stock">Low Stock</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={loadInventory}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Apply Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Branch Groups with Collapsible Sections */}
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-600">Loading inventory...</p>
                </CardContent>
              </Card>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : branchGroups.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Inventory Items</h3>
                  <p className="text-gray-600">No inventory items found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {branchGroups.map((group) => {
                  const isExpanded = expandedBranches.has(group.branch_id);
                  return (
                    <Card key={group.branch_id}>
                      <CardHeader
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleBranch(group.branch_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-500" />
                            )}
                            <Building className="h-5 w-5 text-gray-500" />
                            <div>
                              <CardTitle>{group.branch.name}</CardTitle>
                              <CardDescription>{group.branch.code}</CardDescription>
                      </div>
                      </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline">{group.summary.total_items} items</Badge>
                            <Badge className="bg-green-100 text-green-800">
                              {group.summary.in_stock} in stock
                            </Badge>
                            {group.summary.low_stock > 0 && (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                {group.summary.low_stock} low
                              </Badge>
                            )}
                            {group.summary.out_of_stock > 0 && (
                              <Badge className="bg-red-100 text-red-800">
                                {group.summary.out_of_stock} out
                              </Badge>
                            )}
                      </div>
                    </div>
                      </CardHeader>
                      {isExpanded && (
                        <CardContent>
                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <Card key={item.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-medium">{item.product_name}</h3>
                          <Badge className={getStatusColor(item.status)}>
                                          {item.status.replace('_', ' ')}
                          </Badge>
                                        <Badge variant="outline">{item.sku || 'N/A'}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                                          <span className="font-semibold">{item.stock_quantity} units</span>
                          </div>
                                        {item.reserved_quantity > 0 && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <span>Reserved: {item.reserved_quantity}</span>
                            </div>
                          )}
                            <div className="flex items-center gap-1 text-green-600">
                              <span>Available: {item.available_quantity}</span>
                            </div>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                                          <span>Min: {item.min_threshold}</span>
                            </div>
                          {item.expiry_date && (
                            <div className="flex items-center gap-1">
                              <span>Expires: {new Date(item.expiry_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
                          </div>
                  </CardContent>
                      )}
                </Card>
                  );
                })}
              </div>
              )}
          </TabsContent>

          <TabsContent value="manufacturers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Manufacturers</h2>
              <Button onClick={() => openManufacturerModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Manufacturer
              </Button>
            </div>

            {/* Manufacturer Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {manufacturers.map((manufacturer) => (
                        <tr key={manufacturer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{manufacturer.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{manufacturer.contact_person}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{manufacturer.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{manufacturer.phone}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{manufacturer.address || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{manufacturer.notes || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openManufacturerModal(manufacturer)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteManufacturer(manufacturer.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              {manufacturers.length === 0 && (
                    <div className="p-8 text-center">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Manufacturers</h3>
                    <p className="text-gray-600">No manufacturers have been added yet.</p>
                    </div>
                  )}
                </div>
                  </CardContent>
                </Card>
          </TabsContent>
        </Tabs>

        {/* Manufacturer Modal */}
        <Dialog open={isManufacturerModalOpen} onOpenChange={setIsManufacturerModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingManufacturer ? 'Edit Manufacturer' : 'Add Manufacturer'}
              </DialogTitle>
              <DialogDescription>
                {editingManufacturer ? 'Update manufacturer information' : 'Add a new manufacturer to the directory'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Manufacturer Name *</Label>
                <Input
                  id="name"
                  value={manufacturerForm.name || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, name: e.target.value })}
                  placeholder="Enter manufacturer name"
                />
              </div>
              <div>
                <Label htmlFor="contact_person">Contact Person *</Label>
                <Input
                  id="contact_person"
                  value={manufacturerForm.contact_person || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, contact_person: e.target.value })}
                  placeholder="Enter contact person name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={manufacturerForm.email || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={manufacturerForm.phone || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="product_line">Product Line *</Label>
                <Input
                  id="product_line"
                  value={manufacturerForm.product_line || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, product_line: e.target.value })}
                  placeholder="Enter product line"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={manufacturerForm.address || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={manufacturerForm.website || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, website: e.target.value })}
                  placeholder="Enter website URL"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md"
                  value={manufacturerForm.notes || ''}
                  onChange={(e) => setManufacturerForm({ ...manufacturerForm, notes: e.target.value })}
                  placeholder="Enter notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeManufacturerModal}>
                Cancel
              </Button>
              <Button onClick={saveManufacturer}>
                {editingManufacturer ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCentralInventory;
