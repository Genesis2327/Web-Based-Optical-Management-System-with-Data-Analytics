import { API_BASE_URL, getAuthHeaders } from '@/config/api';

export interface UserGroup {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  users?: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  created_at: string;
  updated_at: string;
}

export const getUserGroups = async (): Promise<UserGroup[]> => {
  const response = await fetch(`${API_BASE_URL}/user-groups`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user groups');
  }

  const data = await response.json();
  return data.data;
};

export const getUserGroup = async (id: number): Promise<UserGroup> => {
  const response = await fetch(`${API_BASE_URL}/user-groups/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user group');
  }

  const data = await response.json();
  return data.data;
};

export const createUserGroup = async (groupData: {
  name: string;
  description?: string;
  is_active?: boolean;
}): Promise<UserGroup> => {
  const response = await fetch(`${API_BASE_URL}/user-groups`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(groupData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create user group');
  }

  const data = await response.json();
  return data.data;
};

export const updateUserGroup = async (
  id: number,
  groupData: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<UserGroup> => {
  const response = await fetch(`${API_BASE_URL}/user-groups/${id}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(groupData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update user group');
  }

  const data = await response.json();
  return data.data;
};

export const deleteUserGroup = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/user-groups/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete user group');
  }
};

export const addUsersToGroup = async (
  groupId: number,
  userIds: number[]
): Promise<UserGroup> => {
  const response = await fetch(`${API_BASE_URL}/user-groups/${groupId}/users`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_ids: userIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add users to group');
  }

  const data = await response.json();
  return data.data;
};

export const removeUsersFromGroup = async (
  groupId: number,
  userIds: number[]
): Promise<UserGroup> => {
  const response = await fetch(`${API_BASE_URL}/user-groups/${groupId}/users`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_ids: userIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove users from group');
  }

  const data = await response.json();
  return data.data;
};

