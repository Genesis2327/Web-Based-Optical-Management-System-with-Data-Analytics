import React, { useState } from 'react';
import { Users, Plus, Edit, Trash2, Search, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getUserGroups, createUserGroup, updateUserGroup, deleteUserGroup, addUsersToGroup, removeUsersFromGroup, UserGroup } from '@/services/userGroupApi';
import { API_BASE_URL, getAuthHeaders } from '@/config/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const UserGroupManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageUsersDialogOpen, setIsManageUsersDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      return data.data || [];
    },
    enabled: isManageUsersDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: createUserGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setIsAddDialogOpen(false);
      toast({
        title: 'Success',
        description: 'User group created successfully',
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
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUserGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setIsEditDialogOpen(false);
      setSelectedGroup(null);
      toast({
        title: 'Success',
        description: 'User group updated successfully',
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
    mutationFn: deleteUserGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast({
        title: 'Success',
        description: 'User group deleted successfully',
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

  const addUsersMutation = useMutation({
    mutationFn: ({ groupId, userIds }: { groupId: number; userIds: number[] }) =>
      addUsersToGroup(groupId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setIsManageUsersDialogOpen(false);
      setSelectedGroup(null);
      setSelectedUserIds(new Set());
      toast({
        title: 'Success',
        description: 'Users added to group successfully',
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

  const removeUsersMutation = useMutation({
    mutationFn: ({ groupId, userIds }: { groupId: number; userIds: number[] }) =>
      removeUsersFromGroup(groupId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast({
        title: 'Success',
        description: 'Users removed from group successfully',
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

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (group: UserGroup) => {
    setSelectedGroup(group);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (group: UserGroup) => {
    if (window.confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
      deleteMutation.mutate(group.id);
    }
  };

  const handleManageUsers = (group: UserGroup) => {
    setSelectedGroup(group);
    const currentUserIds = new Set(group.users?.map(u => u.id) || []);
    setSelectedUserIds(currentUserIds);
    setAvailableUsers(allUsers);
    setIsManageUsersDialogOpen(true);
  };

  const toggleUser = (userId: number) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      is_active: formData.get('is_active') === 'on',
    };

    if (selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSaveUsers = () => {
    if (!selectedGroup) return;
    
    const currentUserIds = new Set(selectedGroup.users?.map(u => u.id) || []);
    const toAdd = Array.from(selectedUserIds).filter(id => !currentUserIds.has(id));
    const toRemove = Array.from(currentUserIds).filter(id => !selectedUserIds.has(id));

    if (toAdd.length > 0) {
      addUsersMutation.mutate({ groupId: selectedGroup.id, userIds: toAdd });
    }
    if (toRemove.length > 0) {
      removeUsersMutation.mutate({ groupId: selectedGroup.id, userIds: toRemove });
    }
    
    if (toAdd.length === 0 && toRemove.length === 0) {
      setIsManageUsersDialogOpen(false);
      setSelectedGroup(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">User Group Management</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedGroup(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User Group</DialogTitle>
              <DialogDescription>Create a new user group to organize users</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Group Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" name="is_active" defaultChecked />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Group'}
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
              <CardTitle>User Groups</CardTitle>
              <CardDescription>Manage user groups and their members</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
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
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {group.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {group.users?.length || 0} members
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.is_active ? 'default' : 'secondary'}>
                        {group.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageUsers(group)}
                          title="Manage Users"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(group)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(group)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Group</DialogTitle>
            <DialogDescription>Update group details</DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Group Name</Label>
                <Input id="edit-name" name="name" defaultValue={selectedGroup.name} required />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={selectedGroup.description || ''} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="edit-active" name="is_active" defaultChecked={selectedGroup.is_active} />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Group'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Users Dialog */}
      <Dialog open={isManageUsersDialogOpen} onOpenChange={setIsManageUsersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Group Members</DialogTitle>
            <DialogDescription>
              Add or remove users from {selectedGroup?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto border rounded p-4">
                <div className="space-y-2">
                  {allUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer"
                      onClick={() => toggleUser(user.id)}
                    >
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        <Badge variant="outline" className="mt-1">{user.role}</Badge>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="h-4 w-4"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsManageUsersDialogOpen(false);
                    setSelectedGroup(null);
                    setSelectedUserIds(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveUsers}
                  disabled={addUsersMutation.isPending || removeUsersMutation.isPending}
                >
                  {addUsersMutation.isPending || removeUsersMutation.isPending
                    ? 'Saving...'
                    : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserGroupManagement;

