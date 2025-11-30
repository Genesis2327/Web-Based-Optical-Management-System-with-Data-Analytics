import React, { useState } from 'react';
import { Shield, Plus, Edit, Trash2, Key, Search, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getRoles, createRole, updateRole, deleteRole, assignPermissionsToRole, Role, Permission } from '@/services/roleApi';
import { getPermissions, Permission as PermissionType } from '@/services/permissionApi';
import { Switch } from '@/components/ui/switch';

const RoleManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
  });

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsAddDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Role created successfully',
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
    mutationFn: ({ id, data }: { id: number; data: any }) => updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      toast({
        title: 'Success',
        description: 'Role updated successfully',
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
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({
        title: 'Success',
        description: 'Role deleted successfully',
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

  const assignPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) =>
      assignPermissionsToRole(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({
        title: 'Success',
        description: 'Permissions assigned successfully',
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

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setSelectedPermissions(new Set(role.permissions?.map(p => p.id) || []));
    setIsEditDialogOpen(true);
  };

  const handleDelete = (role: Role) => {
    if (window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const togglePermission = (permissionId: number) => {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId);
    } else {
      newSet.add(permissionId);
    }
    setSelectedPermissions(newSet);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      description: formData.get('description') as string || undefined,
      permissions: Array.from(selectedPermissions),
    };

    if (selectedRole) {
      updateMutation.mutate({ id: selectedRole.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, PermissionType[]>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Role Management</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setSelectedRole(null);
              setSelectedPermissions(new Set());
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>Create a new role with specific permissions</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Role Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="e.g., senior-staff" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="mt-2 space-y-4 max-h-60 overflow-y-auto border rounded p-4">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module}>
                      <h4 className="font-semibold text-sm mb-2">{module}</h4>
                      <div className="space-y-2">
                        {perms.map(perm => (
                          <div key={perm.id} className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => togglePermission(perm.id)}
                              className="flex items-center space-x-2 hover:bg-gray-100 p-2 rounded w-full"
                            >
                              {selectedPermissions.has(perm.id) ? (
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                              <span className="text-sm">{perm.name}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Role'}
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
              <CardTitle>Roles</CardTitle>
              <CardDescription>Manage user roles and their permissions</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="w-full overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{role.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.is_active ? 'default' : 'secondary'}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {role.permissions?.length || 0} permissions
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role.is_system ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(role)}
                          disabled={role.is_system}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          disabled={role.is_system}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role details and permissions</DialogDescription>
          </DialogHeader>
          {selectedRole && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Role Name</Label>
                <Input id="edit-name" name="name" defaultValue={selectedRole.name} required />
              </div>
              <div>
                <Label htmlFor="edit-slug">Slug</Label>
                <Input id="edit-slug" name="slug" defaultValue={selectedRole.slug} required />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={selectedRole.description || ''} />
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Label htmlFor="edit-active">Active</Label>
                  <Switch
                    id="edit-active"
                    name="is_active"
                    defaultChecked={selectedRole.is_active}
                  />
                </div>
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="mt-2 space-y-4 max-h-60 overflow-y-auto border rounded p-4">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module}>
                      <h4 className="font-semibold text-sm mb-2">{module}</h4>
                      <div className="space-y-2">
                        {perms.map(perm => (
                          <div key={perm.id} className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => togglePermission(perm.id)}
                              className="flex items-center space-x-2 hover:bg-gray-100 p-2 rounded w-full"
                            >
                              {selectedPermissions.has(perm.id) ? (
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                              <span className="text-sm">{perm.name}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Role'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleManagement;

