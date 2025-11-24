import { API_BASE_URL, getAuthHeaders } from '@/config/api';

export interface LensType {
  id: number;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  base_price: number;
  specifications?: Record<string, any>;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export const getLensTypes = async (activeOnly: boolean = false): Promise<LensType[]> => {
  const url = activeOnly 
    ? `${API_BASE_URL}/lens-types/active`
    : `${API_BASE_URL}/lens-types`;
  
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch lens types');
  }

  const data = await response.json();
  return data.data || [];
};

export const getLensType = async (id: number): Promise<LensType> => {
  const response = await fetch(`${API_BASE_URL}/lens-types/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch lens type');
  }

  const data = await response.json();
  return data.data;
};

export const createLensType = async (lensType: Partial<LensType>): Promise<LensType> => {
  const response = await fetch(`${API_BASE_URL}/lens-types`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(lensType),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create lens type');
  }

  const data = await response.json();
  return data.data;
};

export const updateLensType = async (id: number, lensType: Partial<LensType>): Promise<LensType> => {
  const response = await fetch(`${API_BASE_URL}/lens-types/${id}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(lensType),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update lens type');
  }

  const data = await response.json();
  return data.data;
};

export const deleteLensType = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/lens-types/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete lens type');
  }
};

