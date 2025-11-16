import React, { useState } from 'react';
import { Package, Search, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  name: string;
  category: 'frames' | 'lenses' | 'contacts' | 'accessories';
  brand: string;
  sku: string;
  quantity: number;
  minStock: number;
  price: number;
  cost: number;
  supplier: string;
  location: string;
}

const InventoryManagement = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>([
    {
      id: '1',
      name: 'Ray-Ban Aviator Classic',
      category: 'frames',
      brand: 'Ray-Ban',
      sku: 'RB3025-001',
      quantity: 15,
      minStock: 5,
      price: 154.99,
      cost: 92.99,
      supplier: 'Luxottica',
      location: 'A1-001'
    },
    {
      id: '2',
      name: 'Crizal Prevencia Lenses',
      category: 'lenses',
      brand: 'Essilor',
      sku: 'ESS-PREV-001',
      quantity: 3,
      minStock: 10,
      price: 89.99,
      cost: 45.00,
      supplier: 'Essilor Labs',
      location: 'B2-015'
    },
    {
      id: '3',
      name: 'Acuvue Oasys Daily',
      category: 'contacts',
      brand: 'Johnson & Johnson',
      sku: 'JJ-OASYS-30',
      quantity: 25,
      minStock: 15,
      price: 32.99,
      cost: 18.50,
      supplier: 'J&J Vision Care',
      location: 'C1-008'
    },
    {
      id: '4',
      name: 'Lens Cleaning Kit',
      category: 'accessories',
      brand: 'Zeiss',
      sku: 'ZEISS-CLN-001',
      quantity: 8,
      minStock: 20,
      price: 15.99,
      cost: 8.75,
      supplier: 'Zeiss Supplies',
      location: 'D1-003'
    }
  ]);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (quantity: number, minStock: number) => {
    if (quantity <= 0) return { status: 'Out of Stock', color: 'bg-red-500 text-white' };
    if (quantity <= minStock) return { status: 'Low Stock', color: 'bg-yellow-500 text-white' };
    return { status: 'In Stock', color: 'bg-green-500 text-white' };
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      frames: 'bg-blue-100 text-blue-800',
      lenses: 'bg-green-100 text-green-800',
      contacts: 'bg-purple-100 text-purple-800',
      accessories: 'bg-orange-100 text-orange-800'
    };
    return colors[category as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  const handleUpdateStock = (id: string, newQuantity: number) => {
    setInventory(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
    toast({
      title: "Stock Updated",
      description: `Inventory quantity has been updated.`
    });
  };

  const lowStockItems = inventory.filter(item => item.quantity <= item.minStock);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 sm:h-6 sm:w-6 text-staff" />
          <h1 className="text-xl sm:text-2xl font-bold">Inventory Management</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="staff">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Inventory Item</DialogTitle>
              <DialogDescription>
                Add a new item to your inventory system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Item Name</Label>
                  <Input id="name" placeholder="Product name" />
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" placeholder="Stock keeping unit" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frames">Frames</SelectItem>
                      <SelectItem value="lenses">Lenses</SelectItem>
                      <SelectItem value="contacts">Contact Lenses</SelectItem>
                      <SelectItem value="accessories">Accessories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" placeholder="Brand name" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="minStock">Min Stock</Label>
                  <Input id="minStock" type="number" placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="number" step="0.01" placeholder="0.00" />
                </div>
              </div>
              <Button className="w-full" variant="staff">Add to Inventory</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-800">Low Stock Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="font-medium">{item.name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{item.quantity} remaining</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {/* Open reorder dialog */}}
                    >
                      Reorder
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, SKU, or brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="frames">Frames</SelectItem>
                <SelectItem value="lenses">Lenses</SelectItem>
                <SelectItem value="contacts">Contact Lenses</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items ({filteredInventory.length})</CardTitle>
          <CardDescription>
            Manage your clinic's inventory and stock levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead>Item Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => {
                const stockStatus = getStockStatus(item.quantity, item.minStock);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.brand}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(item.category)}>
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{item.quantity}</div>
                        <div className="text-muted-foreground">Min: {item.minStock}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={stockStatus.color}>
                        {stockStatus.status}
                      </Badge>
                    </TableCell>
                    <TableCell>₱{item.price.toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-sm">{item.location}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryManagement;