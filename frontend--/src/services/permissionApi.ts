import { API_BASE_URL, getAuthHeaders } from '@/config/api';

export interface Permission {
  id: number;
  name: string;
  slug: string;
  module?: string;
  description?: string;
  roles?: Array<{ id: number; name: string }>;
  created_at: string;
  updated_at: string;
}

export const getPermissions = async (module?: string): Promise<Permission[]> => {
  const url = module 
    ? `${API_BASE_URL}/permissions?module=${module}`
    : `${API_BASE_URL}/permissions`;
  
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch permissions');
  }

  const data = await response.json();
  return data.data;
};

export const getPermissionsByModule = async (): Promise<Record<string, Permission[]>> => {
  const response = await fetch(`${API_BASE_URL}/permissions/by-module`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch permissions by module');
  }

  const data = await response.json();
  return data.data;
};

export const getPermission = async (id: number): Promise<Permission> => {
  const response = await fetch(`${API_BASE_URL}/permissions/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch permission');
  }

  const data = await response.json();
  return data.data;
};

export const createPermission = async (permissionData: {
  name: string;
  slug: string;
  module?: string;
  description?: string;
}): Promise<Permission> => {
  const response = await fetch(`${API_BASE_URL}/permissions`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(permissionData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create permission');
  }

  const data = await response.json();
  return data.data;
};

export const updatePermission = async (
  id: number,
  permissionData: {
    name?: string;
    slug?: string;
    module?: string;
    description?: string;
  }
): Promise<Permission> => {
  const response = await fetch(`${API_BASE_URL}/permissions/${id}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(permissionData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update permission');
  }

  const data = await response.json();
  return data.data;
};

export const deletePermission = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/permissions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete permission');
  }
};

