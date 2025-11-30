import { API_BASE_URL, getAuthHeaders } from '@/config/api';

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  permissions?: Permission[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  name: string;
  slug: string;
  module?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const getRoles = async (): Promise<Role[]> => {
  const response = await fetch(`${API_BASE_URL}/roles`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }

  const data = await response.json();
  return data.data;
};

export const getRole = async (id: number): Promise<Role> => {
  const response = await fetch(`${API_BASE_URL}/roles/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch role');
  }

  const data = await response.json();
  return data.data;
};

export const createRole = async (roleData: {
  name: string;
  slug: string;
  description?: string;
  permissions?: number[];
}): Promise<Role> => {
  const response = await fetch(`${API_BASE_URL}/roles`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(roleData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create role');
  }

  const data = await response.json();
  return data.data;
};

export const updateRole = async (
  id: number,
  roleData: {
    name?: string;
    slug?: string;
    description?: string;
    is_active?: boolean;
    permissions?: number[];
  }
): Promise<Role> => {
  const response = await fetch(`${API_BASE_URL}/roles/${id}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(roleData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update role');
  }

  const data = await response.json();
  return data.data;
};

export const deleteRole = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/roles/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete role');
  }
};

export const assignPermissionsToRole = async (
  roleId: number,
  permissionIds: number[]
): Promise<Role> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/permissions`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissions: permissionIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to assign permissions');
  }

  const data = await response.json();
  return data.data;
};

