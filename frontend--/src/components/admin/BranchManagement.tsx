import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Search, MapPin, Phone, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBranches } from '@/services/branchApi';
import { API_BASE_URL } from '@/config/api';

interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const BranchManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch branches
  const { data: branches = [], isLoading, refetch } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    is_active: true
  });

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = sessionStorage.getItem('auth_token');
      
      // Prepare data - convert empty strings to null for optional fields
      const requestData = {
        ...formData,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
      };
      
      const response = await fetch(`${API_BASE_URL}/branches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Extract validation errors if they exist
        if (errorData.errors) {
          // Format validation errors nicely
          const errorMessages: string[] = [];
          Object.keys(errorData.errors).forEach((field) => {
            const fieldErrors = errorData.errors[field];
            if (Array.isArray(fieldErrors)) {
              fieldErrors.forEach((error: string) => {
                errorMessages.push(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${error}`);
              });
            } else {
              errorMessages.push(`${field}: ${fieldErrors}`);
            }
          });
          
          const errorMessage = errorMessages.length > 0 
            ? errorMessages.join('. ') 
            : errorData.message || 'Failed to create branch';
          
          throw new Error(errorMessage);
        }
        
        throw new Error(errorData.message || 'Failed to create branch');
      }

      toast({
        title: "Success",
        description: "Branch created successfully",
      });

      setIsAddDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create branch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;

    try {
      setLoading(true);
      const token = sessionStorage.getItem('auth_token');
      
      const response = await fetch(`${API_BASE_URL}/branches/${selectedBranch.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          // Convert empty strings to null for optional fields
          phone: formData.phone || null,
          email: formData.email || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Extract validation errors if they exist
        if (errorData.errors) {
          const errorMessages = Object.values(errorData.errors).flat().join(', ');
          throw new Error(errorMessages || errorData.message || 'Failed to update branch');
        }
        throw new Error(errorData.message || 'Failed to update branch');
      }

      toast({
        title: "Success",
        description: "Branch updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedBranch(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update branch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!confirm('Are you sure you want to delete this branch? This action cannot be undone.')) return;

    try {
      setLoading(true);
      const token = sessionStorage.getItem('auth_token');
      
      const response = await fetch(`${API_BASE_URL}/branches/${branchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete branch');
      }

      toast({
        title: "Success",
        description: "Branch deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete branch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      is_active: true
    });
  };

  const openEditDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name || '',
      code: branch.code || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      is_active: branch.is_active ?? true
    });
    setIsEditDialogOpen(true);
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading branches...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Branch Management</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={resetForm}
              className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Branch</DialogTitle>
              <DialogDescription>
                Create a new branch location with contact information.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Branch Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Branch Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 10);
                      setFormData({ ...formData, code: value });
                    }}
                    placeholder="e.g., MAIN, STA_ROSA (max 10 chars)"
                    maxLength={10}
                    required
                  />
                  <p className="text-xs text-gray-500">Maximum 10 characters. Only letters, numbers, and underscores.</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0912-345-6789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="branch@everbright.com"
                  />
                </div>
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

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="min-w-[120px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Branch'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Branches</CardTitle>
          <CardDescription>
            Manage branch locations, contact information, and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBranches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {branch.code}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{branch.address}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {branch.phone && (
                        <div className="flex items-center space-x-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-xs">{branch.phone}</span>
                        </div>
                      )}
                      {branch.email && (
                        <div className="flex items-center space-x-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span className="text-xs">{branch.email}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      branch.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(branch.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(branch)}
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-300"
                        title="Edit Branch"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
                        title="Delete Branch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Branch Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information and contact details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateBranch} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Branch Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">Branch Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 10);
                    setFormData({ ...formData, code: value });
                  }}
                  placeholder="e.g., MAIN, STA_ROSA (max 10 chars)"
                  maxLength={10}
                  required
                />
                <p className="text-xs text-gray-500">Maximum 10 characters. Only letters, numbers, and underscores.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="min-w-[120px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Branch'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchManagement;
