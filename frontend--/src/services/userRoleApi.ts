import { API_BASE_URL, getAuthHeaders } from '@/config/api';
import { Role, Permission } from './roleApi';

export const assignRolesToUser = async (
  userId: number,
  roleIds: number[]
): Promise<Role[]> => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/roles`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role_ids: roleIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to assign roles to user');
  }

  const data = await response.json();
  return data.data;
};

export const removeRolesFromUser = async (
  userId: number,
  roleIds: number[]
): Promise<Role[]> => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/roles`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role_ids: roleIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove roles from user');
  }

  const data = await response.json();
  return data.data;
};

export const getUserRoles = async (userId: number): Promise<Role[]> => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/roles`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user roles');
  }

  const data = await response.json();
  return data.data;
};

export const getUserPermissions = async (userId: number): Promise<Permission[]> => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/permissions`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user permissions');
  }

  const data = await response.json();
  return data.data;
};

