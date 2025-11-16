export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category?: string; // For display purposes
  category_id?: number;
  image_paths: string[]; // array of image file paths
  image_order?: string[]; // array of image paths in display order
  stock_quantity: number;
  is_active: boolean;
  created_by?: number;
  created_by_role?: string;
  created_at: string;
  updated_at: string;
  
  // Optional fields for enhanced functionality
  expiry_date?: string;
  min_stock_threshold?: number;
  auto_restock_quantity?: number;
  auto_restock_enabled?: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected';
  branch_id?: number;
  image_metadata?: any;
  primary_image?: string;
  secondary_image?: string;
  attributes?: any;
  brand?: string;
  model?: string;
  sku?: string;
  
  // Relationships
  creator?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  category_details?: {
    id: number;
    name: string;
    slug: string;
    icon?: string;
    color?: string;
  };
  branch_availability?: BranchAvailability[];
}

// Legacy interface for backward compatibility
export interface LegacyProduct {
  id: string;
  name: string;
  model: string;
  description: string;
  price: number;
  images: string[]; // array of image URLs or base64 strings
  badges: string[]; // e.g., ["Best Seller", "In Stock"]
  options: {
    color?: string;
    prescription: boolean; // true for prescription, false for non-prescription
  };
}

export interface ReservationItem {
  productId: string;
  quantity: number;
}

// Branch availability for multi-branch products
export interface BranchAvailability {
  branch: {
    id: number;
    name: string;
    code: string;
    address?: string;
    phone?: string;
  };
  available_quantity: number;
  stock_quantity: number;
  reserved_quantity: number;
  is_available: boolean;
}

// Product category
export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  product_count?: number;
  is_active: boolean;
}

// Form data for creating/updating products
export interface ProductFormData {
  name: string;
  description: string;
  price: number;
  category_id?: number;
  stock_quantity: number;
  is_active?: boolean;
  brand?: string;
  model?: string;
  sku?: string;
  images?: File[];
  branch_id?: number;
}
