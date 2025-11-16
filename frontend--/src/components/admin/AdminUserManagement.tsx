import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Edit, Eye, EyeOff, Trash2, Building2, UserCheck, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBranches } from '@/services/branchApi';
import { API_BASE_URL, getAuthHeaders } from '@/config/api';

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  social_media?: string;
  address?: string;
  role: string;
  is_approved: boolean;
  branch?: {
    id: number;
    name: string;
    address: string;
  };
  optometrist_branches?: Array<{
    id: number;
    name?: string;
    address?: string;
  }>;
  created_at: string;
}

const AdminUserManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [deletedUserIds, setDeletedUserIds] = useState<Set<number>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
    role: 'customer',
    branch_id: '',
    selected_branches: [] as number[],
    is_approved: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('auth_token');
      console.log('Fetching users with token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: getAuthHeaders(),
      });

      console.log('Users API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.message || `Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      console.log('Users data received:', data);
      const allUsers = data.data || [];
      
      // Filter out deleted users to prevent them from reappearing
      const filteredUsers = allUsers.filter((user: User) => !deletedUserIds.has(user.id));
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name
    const nameError = validateName(formData.name);
    if (nameError) {
      toast({
        title: "Validation Error",
        description: nameError,
        variant: "destructive",
      });
      return;
    }
    
    // Client-side validation
    if (formData.password !== formData.password_confirmation) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const token = sessionStorage.getItem('auth_token');
      
      // Build request data
      const requestData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        role: formData.role,
        branch_id: formData.branch_id && formData.branch_id !== 'none' ? parseInt(formData.branch_id) : null,
        is_approved: formData.is_approved,
      };
      
      console.log('Original form data:', formData);
      console.log('Processed request data:', requestData);
      console.log('Branch ID type:', typeof requestData.branch_id);
      console.log('Branch ID value:', requestData.branch_id);
      
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestData),
      });

      console.log('Create user response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create user error:', errorData);
        console.error('Validation errors:', errorData.errors);
        throw new Error(errorData.message || `Failed to create user: ${response.status}`);
      }

      const result = await response.json();
      console.log('User created successfully:', result);

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setIsAddDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    // Validate name
    const nameError = validateName(formData.name);
    if (nameError) {
      toast({
        title: "Validation Error",
        description: nameError,
        variant: "destructive",
      });
      return;
    }

    // Client-side validation for password confirmation
    if (formData.password && formData.password !== formData.password_confirmation) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = sessionStorage.getItem('auth_token');
      
      // Build request data, only include fields that should be updated
      const requestData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
        branch_id: formData.branch_id && formData.branch_id !== 'none' ? parseInt(formData.branch_id) : null,
        is_approved: formData.is_approved,
      };
      
      // Only include password if it's being changed (not empty)
      if (formData.password && formData.password.trim() !== '') {
        requestData.password = formData.password;
      }
      
      console.log('Updating user with data:', requestData);
      console.log('Role:', formData.role);
      
      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestData),
      });

      console.log('Update user response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Update user error:', errorData);
        throw new Error(errorData.message || `Failed to update user: ${response.status}`);
      }

      const result = await response.json();
      console.log('User updated successfully:', result);

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;

    try {
      const token = sessionStorage.getItem('auth_token');
      console.log('Deleting user ID:', userId);
      console.log('Auth token present:', token ? 'Yes' : 'No');
      console.log('Auth token value:', token);
      
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to perform this action",
          variant: "destructive",
        });
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      console.log('Delete user response status:', response.status);
      console.log('Delete user response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete user error:', errorData);
        
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.message || `Failed to delete user: ${response.status}`);
      }

      const result = await response.json();
      console.log('User deleted successfully:', result);
      
      // Add to deleted users set to prevent reappearing
      setDeletedUserIds(prev => new Set([...prev, userId]));
      
      // Immediately remove the user from the local state
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      
      toast({
        title: "Success",
        description: "User permanently deleted successfully",
      });

      // Don't call fetchUsers() as it might override the immediate update
      // The immediate state update is sufficient for good UX
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      password_confirmation: '',
      role: 'customer',
      branch_id: '',
      selected_branches: [],
      is_approved: true
    });
  };

  const validateName = (name: string) => {
    const trimmedName = name.trim();
    if (trimmedName.toLowerCase().endsWith(' user')) {
      return 'Please do not add "User" to the name - enter the person\'s actual name only';
    }
    if (trimmedName.length < 2) {
      return 'Name must be at least 2 characters long';
    }
    return null;
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    
    // For optometrists, extract branch IDs from optometrist_branches if available
    let selectedBranches: number[] = [];
    if (user.role === 'optometrist' && user.optometrist_branches && Array.isArray(user.optometrist_branches)) {
      selectedBranches = user.optometrist_branches.map((b) => b.id);
    }
    
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '', // Don't pre-fill password
      password_confirmation: '', // Don't pre-fill password confirmation
      role: user.role,
      branch_id: user.branch?.id?.toString() || 'none',
      selected_branches: selectedBranches,
      is_approved: user.is_approved
    });
    
    console.log('Opening edit dialog for user:', user);
    setIsEditDialogOpen(true);
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'optometrist':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'customer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update select all state when filtered users change
  useEffect(() => {
    setIsAllSelected(selectedUsers.size === filteredUsers.length && filteredUsers.length > 0);
  }, [selectedUsers, filteredUsers]);

  // Handle individual user selection
  const handleUserSelect = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
    setIsAllSelected(newSelected.size === filteredUsers.length && filteredUsers.length > 0);
  };

  // Handle select all functionality
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUsers(new Set());
      setIsAllSelected(false);
    } else {
      const allUserIds = new Set(filteredUsers.map(user => user.id));
      setSelectedUsers(allUserIds);
      setIsAllSelected(true);
    }
  };

  // Bulk delete selected users
  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to delete.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = sessionStorage.getItem('auth_token');
      const deletePromises = Array.from(selectedUsers).map(userId =>
        fetch(`${API_BASE_URL}/admin/users/${userId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(result => !result.ok);
      
      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} user(s)`);
      }

      // Add to deleted users set to prevent reappearing
      setDeletedUserIds(prev => new Set([...prev, ...selectedUsers]));
      
      // Immediately remove deleted users from local state
      setUsers(prevUsers => prevUsers.filter(user => !selectedUsers.has(user.id)));

      toast({
        title: "Success",
        description: `Successfully deleted ${selectedUsers.size} user(s).`,
      });

      setSelectedUsers(new Set());
      setIsAllSelected(false);
      
      // Don't call fetchUsers() as it might override the immediate update
      // The immediate state update is sufficient for good UX
    } catch (error) {
      console.error('Error deleting users:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete users",
        variant: "destructive",
      });
    }
  };

  // Bulk approve selected users
  const handleBulkApprove = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to approve.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = sessionStorage.getItem('auth_token');
      const approvePromises = Array.from(selectedUsers).map(userId =>
        fetch(`${API_BASE_URL}/admin/users/${userId}/approve`, {
          method: 'POST',
          headers: getAuthHeaders(),
        })
      );

      const results = await Promise.all(approvePromises);
      const failed = results.filter(result => !result.ok);
      
      if (failed.length > 0) {
        throw new Error(`Failed to approve ${failed.length} user(s)`);
      }

      toast({
        title: "Success",
        description: `Successfully approved ${selectedUsers.size} user(s).`,
      });

      setSelectedUsers(new Set());
      setIsAllSelected(false);
      fetchUsers();
    } catch (error) {
      console.error('Error approving users:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve users",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">User Management</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with role and branch assignment. Note: Optometrists can select which branches to handle using checkboxes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name (e.g., John Smith)"
                    required
                  />
                  <p className="text-xs text-gray-500">Enter the person's actual name - do not add "User" suffix</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Contact Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter contact number (e.g., 09123456789)"
                  />
                  <p className="text-xs text-gray-500">Optional - Contact number for the user</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Generate a random password (12 characters: uppercase, lowercase, numbers)
                      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
                      const numbers = '0123456789';
                      const allChars = uppercase + lowercase + numbers;
                      
                      let password = '';
                      // Ensure at least one of each type
                      password += uppercase[Math.floor(Math.random() * uppercase.length)];
                      password += lowercase[Math.floor(Math.random() * lowercase.length)];
                      password += numbers[Math.floor(Math.random() * numbers.length)];
                      
                      // Fill the rest randomly
                      for (let i = password.length; i < 12; i++) {
                        password += allChars[Math.floor(Math.random() * allChars.length)];
                      }
                      
                      // Shuffle the password
                      password = password.split('').sort(() => Math.random() - 0.5).join('');
                      
                      setFormData({
                        ...formData,
                        password: password,
                        password_confirmation: password
                      });
                      
                      toast({
                        title: "Password Generated",
                        description: "A random password has been generated and filled in both fields.",
                      });
                    }}
                    className="flex items-center gap-1 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Generate
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password_confirmation">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="password_confirmation"
                    type={showPasswordConfirmation ? "text" : "password"}
                    value={formData.password_confirmation}
                    onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ 
                    ...formData, 
                    role: value, 
                    branch_id: value === 'optometrist' ? '' : formData.branch_id,
                    selected_branches: value === 'optometrist' ? [] : (formData.selected_branches || [])
                  })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="optometrist">Optometrist</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Branch Selection - Simple dropdown for all roles */}
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Select 
                    value={formData.branch_id} 
                    onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Branch</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_approved"
                  checked={formData.is_approved}
                  onChange={(e) => setFormData({ ...formData, is_approved: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_approved">Approved</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage user accounts, roles, and branch assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            {selectedUsers.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedUsers.size} user(s) selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkApprove}
                  className="text-green-600 hover:text-green-700"
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Approve All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete All
                </Button>
              </div>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center w-4 h-4 rounded border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className={selectedUsers.has(user.id) ? 'bg-blue-50' : ''}>
                  <TableCell>
                    <button
                      onClick={() => handleUserSelect(user.id)}
                      className="flex items-center justify-center w-4 h-4 rounded border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {selectedUsers.has(user.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getRoleColor(user.role)}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.branch ? (
                      <div className="flex items-center space-x-1">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{user.branch.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No Branch</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_approved ? "default" : "secondary"}>
                      {user.is_approved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-700"
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information, role, and branch assignment. Note: Optometrists can select which branches to handle using checkboxes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name (e.g., John Smith)"
                  required
                />
                <p className="text-xs text-gray-500">Enter the person's actual name - do not add "User" suffix</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Contact Number</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter contact number (e.g., 09123456789)"
                />
                <p className="text-xs text-gray-500">Optional - Contact number for the user</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password or leave blank"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-password-confirmation">Confirm New Password</Label>
              <Input
                id="edit-password-confirmation"
                type="password"
                value={formData.password_confirmation}
                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ 
                  ...formData, 
                  role: value, 
                  branch_id: value === 'optometrist' ? '' : formData.branch_id,
                  selected_branches: value === 'optometrist' ? [] : (formData.selected_branches || [])
                })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="optometrist">Optometrist</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Branch Selection - Checkboxes for Optometrists, Dropdown for others */}
              <div className="space-y-2">
                <Label htmlFor="edit-branch">
                  Branch {formData.role === 'optometrist' && <span className="text-blue-500">*</span>}
                </Label>
                
                {formData.role === 'optometrist' ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 mb-2">
                      Select which branches this optometrist will handle:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {branches.map((branch) => (
                        <div key={branch.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`edit-branch-${branch.id}`}
                            checked={(formData.selected_branches || []).includes(branch.id)}
                            onChange={(e) => {
                              const currentBranches = formData.selected_branches || [];
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  selected_branches: [...currentBranches, branch.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  selected_branches: currentBranches.filter(id => id !== branch.id)
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor={`edit-branch-${branch.id}`} className="text-sm">
                            {branch.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      <strong>Selected:</strong> {(formData.selected_branches || []).length} branch(es) - 
                      {(formData.selected_branches || []).length === 0 && ' None selected'}
                      {(formData.selected_branches || []).length === 1 && ' 1 branch'}
                      {(formData.selected_branches || []).length > 1 && ` ${(formData.selected_branches || []).length} branches`}
                      {(formData.selected_branches || []).length === branches.length && ' (All branches)'}
                    </div>
                  </div>
                ) : (
                  <Select 
                    value={formData.branch_id} 
                    onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Branch</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_approved"
                checked={formData.is_approved}
                onChange={(e) => setFormData({ ...formData, is_approved: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-is_approved">Approved</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;
