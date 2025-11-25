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
  // Use the public /lens-types/active route for active-only requests
  // This route is accessible to all authenticated users (not just admin)
  const url = activeOnly 
    ? `${API_BASE_URL}/lens-types/active`
    : `${API_BASE_URL}/lens-types`;
  
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    // If the active route doesn't exist, try the regular route with query parameter
    if (activeOnly && response.status === 404) {
      try {
        const fallbackResponse = await fetch(`${API_BASE_URL}/lens-types?active_only=true`, {
          headers: getAuthHeaders(),
        });
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const allTypes = fallbackData.data || [];
          // Filter active types on client side if needed
          return allTypes.filter((type: LensType) => type.is_active);
        }
      } catch (e) {
        // Ignore fallback error
      }
    }
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

/**
 * Get lens type name from slug
 * This is a helper function to convert slug to display name
 */
export const getLensTypeName = (slug: string, lensTypes: LensType[] = []): string => {
  if (!slug) return 'Not specified';
  
  // Try to find in provided lens types
  const lensType = lensTypes.find(lt => lt.slug === slug);
  if (lensType) return lensType.name;
  
  // Fallback to default mappings
  const defaultMappings: Record<string, string> = {
    'ordinary': 'Ordinary Lens',
    'anti_radiation': 'Anti-Radiation Lens',
    'photochromic': 'Photochromic Lens',
    'photochromic_lens': 'Photochromic Lens',
  };
  
  return defaultMappings[slug] || slug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Get lens type by slug
 */
export const getLensTypeBySlug = async (slug: string): Promise<LensType | null> => {
  try {
    const types = await getLensTypes();
    return types.find(lt => lt.slug === slug) || null;
  } catch (error) {
    console.error('Failed to fetch lens type by slug:', error);
    return null;
  }
};

