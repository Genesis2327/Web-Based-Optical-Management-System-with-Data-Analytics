import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Store,
  DollarSign,
  Eye,
  Building
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const API_BASE_URL = 'http://127.0.0.1:8000/api';

interface BranchAvailability {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  status: string;
  price_override?: number | string | null;
}

interface ConsolidatedProduct {
  id: number;
  name: string;
  sku: string;
  brand?: string;
  model?: string;
  price: number | string;
  total_stock: number;
  total_reserved: number;
  available_stock: number;
  branches_count: number;
  branch_availability: BranchAvailability[];
  image?: string;
}

interface Summary {
  total_products: number;
  total_stock_value: number | string;
  low_stock_count: number;
  out_of_stock_count: number;
}

const AdminConsolidatedInventory: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ConsolidatedProduct[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  const loadConsolidatedInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/inventory/enhanced`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setProducts(response.data.products || []);
      setSummary(response.data.summary || null);
    } catch (err: any) {
      console.error('Error loading consolidated inventory:', err);
      setError(err.response?.data?.message || 'Failed to load consolidated inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Only administrators can access consolidated inventory view');
      return;
    }
    
    loadConsolidatedInventory();
    // Auto-refresh every 30 seconds to show latest inventory updates from staff
    const interval = setInterval(loadConsolidatedInventory, 30000);
    return () => clearInterval(interval);
  }, [loadConsolidatedInventory, user]);

  const toggleProductExpansion = (productId: number) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = searchTerm === '' || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.model?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [products, searchTerm]);

  const getStockStatus = (product: ConsolidatedProduct) => {
    // If no available stock anywhere, out of stock
    if (product.available_stock <= 0) {
      return { label: 'Out of Stock', color: 'bg-red-500' };
    }

    // Check if any branch has low stock status
    const hasLowStockBranches = product.branch_availability.some(branch =>
      branch.status.toLowerCase().includes('low')
    );

    // If any branch has low stock, the consolidated view should show low stock
    if (hasLowStockBranches) {
      return { label: 'Low Stock', color: 'bg-yellow-500' };
    }

    // Check if all branches with stock are properly stocked
    const hasInStockBranches = product.branch_availability.some(branch =>
      branch.status.toLowerCase().includes('in') && !branch.status.toLowerCase().includes('low')
    );

    if (hasInStockBranches) {
      return { label: 'In Stock', color: 'bg-green-500' };
    }

    // Default to in stock if we have stock but unclear status
    return { label: 'In Stock', color: 'bg-green-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading consolidated inventory...</span>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unauthorized. Only administrators can access this page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Consolidated Inventory</h1>
          <p className="text-muted-foreground mt-1">
            System-wide inventory across all branches
          </p>
        </div>
        <Button onClick={loadConsolidatedInventory} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_products}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱{Number(summary.total_stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Products</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.low_stock_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.out_of_stock_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, brand, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({filteredProducts.length})</CardTitle>
          <CardDescription>
            Click on a product to view branch-specific availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products found
              </div>
            ) : (
              filteredProducts.map((product) => {
                const status = getStockStatus(product);
                const isExpanded = expandedProducts.has(product.id);

                return (
                  <Collapsible key={product.id} open={isExpanded} onOpenChange={() => toggleProductExpansion(product.id)}>
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {product.image && (
                                <img 
                                  src={product.image} 
                                  alt={product.name}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              )}
                              <div className="text-left">
                                <div className="font-semibold">{product.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  SKU: {product.sku}
                                  {product.brand && ` • ${product.brand}`}
                                  {product.model && ` - ${product.model}`}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Total Stock</div>
                                <div className="font-semibold">{product.total_stock}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Available</div>
                                <div className="font-semibold text-green-600">{product.available_stock}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Branches</div>
                                <div className="font-semibold flex items-center gap-1">
                                  <Building className="h-4 w-4" />
                                  {product.branches_count}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Price</div>
                                <div className="font-semibold">₱{Number(product.price || 0).toFixed(2)}</div>
                              </div>
                              <Badge className={status.color}>{status.label}</Badge>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <CardContent>
                          <div className="pt-4 border-t">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              Branch Availability
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {product.branch_availability.map((branch) => (
                                <Card key={branch.branch_id} className="border-2">
                                  <CardContent className="p-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="font-semibold">{branch.branch_name}</div>
                                        <Badge variant="outline">{branch.branch_code}</Badge>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                          <div className="text-muted-foreground">Stock</div>
                                          <div className="font-medium">{branch.stock_quantity}</div>
                                        </div>
                                        <div>
                                          <div className="text-muted-foreground">Available</div>
                                          <div className="font-medium text-green-600">{branch.available_quantity}</div>
                                        </div>
                                        <div>
                                          <div className="text-muted-foreground">Reserved</div>
                                          <div className="font-medium text-blue-600">{branch.reserved_quantity}</div>
                                        </div>
                                        <div>
                                          <div className="text-muted-foreground">Status</div>
                                          <Badge 
                                            className={
                                              branch.status.toLowerCase().includes('out') ? 'bg-red-500' :
                                              branch.status.toLowerCase().includes('low') ? 'bg-yellow-500' :
                                              'bg-green-500'
                                            }
                                            variant="secondary"
                                          >
                                            {branch.status}
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      {branch.price_override && (
                                        <div className="text-sm pt-2 border-t">
                                          <div className="text-muted-foreground">Branch Price</div>
                                          <div className="font-medium">₱{Number(branch.price_override || 0).toFixed(2)}</div>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminConsolidatedInventory;
