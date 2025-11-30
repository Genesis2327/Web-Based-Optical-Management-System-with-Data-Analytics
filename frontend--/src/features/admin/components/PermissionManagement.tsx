import React, { useState } from 'react';
import { Key, Plus, Edit, Trash2, Search, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getPermissions, getPermissionsByModule, createPermission, updatePermission, deletePermission, Permission } from '@/services/permissionApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PermissionManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('table');

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
  });

  const { data: permissionsByModule = {} } = useQuery({
    queryKey: ['permissions-by-module'],
    queryFn: getPermissionsByModule,
    enabled: viewMode === 'grouped',
  });

  const createMutation = useMutation({
    mutationFn: createPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['permissions-by-module'] });
      setIsAddDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Permission created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updatePermission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['permissions-by-module'] });
      setIsEditDialogOpen(false);
      setSelectedPermission(null);
      toast({
        title: 'Success',
        description: 'Permission updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['permissions-by-module'] });
      toast({
        title: 'Success',
        description: 'Permission deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const modules = Array.from(new Set(permissions.map(p => p.module).filter(Boolean))) as string[];

  const filteredPermissions = permissions.filter(perm => {
    const matchesSearch = 
      perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.module?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = moduleFilter === 'all' || perm.module === moduleFilter;
    
    return matchesSearch && matchesModule;
  });

  const handleEdit = (permission: Permission) => {
    setSelectedPermission(permission);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (permission: Permission) => {
    if (window.confirm(`Are you sure you want to delete the permission "${permission.name}"?`)) {
      deleteMutation.mutate(permission.id);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawModule = formData.get('module') as string | null;
    const normalizedModule =
      !rawModule || rawModule === '__none__' ? undefined : (rawModule as string);

    const data = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      module: normalizedModule,
      description: formData.get('description') as string || undefined,
    };

    if (selectedPermission) {
      updateMutation.mutate({ id: selectedPermission.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Key className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Permission Management</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedPermission(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Permission
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Permission</DialogTitle>
              <DialogDescription>Create a new permission for role-based access control</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Permission Name</Label>
                <Input id="name" name="name" required placeholder="e.g., View Products" />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="e.g., view-products" />
              </div>
              <div>
                <Label htmlFor="module">Module</Label>
                <Select name="module">
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Use sentinel value instead of empty string to avoid Radix error */}
                    <SelectItem value="__none__">None</SelectItem>
                    {modules.map(module => (
                      <SelectItem key={module} value={module}>{module}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Permission'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>Manage system permissions</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {modules.map(module => (
                    <SelectItem key={module} value={module}>{module}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'grouped')}>
            <TabsList>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="grouped">Grouped by Module</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPermissions.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell className="font-medium">{permission.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{permission.slug}</code>
                        </TableCell>
                        <TableCell>
                          {permission.module ? (
                            <Badge variant="outline">
                              <Folder className="h-3 w-3 mr-1" />
                              {permission.module}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {permission.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(permission)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(permission)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="grouped">
              <div className="space-y-6">
                {Object.entries(permissionsByModule).map(([module, perms]: [string, any]) => (
                  <Card key={module}>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Folder className="h-5 w-5" />
                        <span>{module || 'Other'}</span>
                        <Badge variant="secondary">{perms.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {perms.map((perm: Permission) => (
                          <div key={perm.id} className="border rounded p-3">
                            <div className="font-medium">{perm.name}</div>
                            <code className="text-xs text-muted-foreground">{perm.slug}</code>
                            {perm.description && (
                              <p className="text-sm text-muted-foreground mt-1">{perm.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>Update permission details</DialogDescription>
          </DialogHeader>
          {selectedPermission && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Permission Name</Label>
                <Input id="edit-name" name="name" defaultValue={selectedPermission.name} required />
              </div>
              <div>
                <Label htmlFor="edit-slug">Slug</Label>
                <Input id="edit-slug" name="slug" defaultValue={selectedPermission.slug} required />
              </div>
              <div>
                <Label htmlFor="edit-module">Module</Label>
                <Select name="module" defaultValue={selectedPermission.module || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Use sentinel value instead of empty string to avoid Radix error */}
                    <SelectItem value="__none__">None</SelectItem>
                    {modules.map(module => (
                      <SelectItem key={module} value={module}>{module}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={selectedPermission.description || ''} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Permission'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionManagement;

