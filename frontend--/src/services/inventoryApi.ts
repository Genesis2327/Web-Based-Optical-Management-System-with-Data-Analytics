import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Include auth token if present (use sessionStorage for consistency)
axios.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface InventoryItem {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category: string;
    price: number;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    address: string;
    phone: string;
  };
  stock: {
    available_quantity: number;
    stock_quantity: number;
    reserved_quantity: number;
    is_available: boolean;
    is_low_stock: boolean;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
  };
  metadata: {
    last_updated: string;
    expiry_date?: string;
    auto_restock_enabled: boolean;
    min_stock_threshold: number;
  };
}

export interface StockAlert {
  type: 'out_of_stock' | 'low_stock' | 'expiring';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  product_id: string;
  branch_id: string;
  timestamp: string;
  action_required: boolean;
  available_quantity?: number;
  expiry_date?: string;
  days_until_expiry?: number;
}

export interface StockTransfer {
  id: string;
  product: {
    id: string;
    name: string;
  };
  fromBranch: {
    id: string;
    name: string;
  };
  toBranch: {
    id: string;
    name: string;
  };
  quantity: number;
  status: 'pending' | 'completed' | 'rejected';
  requested_by: string;
  processed_by?: string;
  reason?: string;
  notes?: string;
  created_at: string;
  processed_at?: string;
}

export interface InventorySummary {
  total_items: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_available_quantity: number;
}

export interface InventoryFilters {
  search?: string;
  status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  branch_id?: string;
  include_out_of_stock?: boolean;
  force_refresh?: boolean;
}

export interface StockTransferRequest {
  product_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  reason: string;
}

export interface StockUpdateRequest {
  stock_quantity: number;
  reason?: string;
}

class InventoryApiService {
  /**
   * Get real-time inventory data
   */
  async getRealTimeInventory(filters: InventoryFilters = {}): Promise<{
    inventory: InventoryItem[];
    summary: InventorySummary;
    timestamp: string;
    cache_expires_at: string;
  }> {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.branch_id) params.append('branch_id', filters.branch_id);
    if (filters.include_out_of_stock) params.append('include_out_of_stock', 'true');
    if (filters.force_refresh) params.append('force_refresh', 'true');

    const response = await axios.get(`${API_BASE_URL}/inventory/enhanced?${params}`);
    const data = response.data || {};
    const inventory = (data.inventory ?? data.inventories) || [];
    return { ...data, inventory };
  }

  /**
   * Get cross-branch availability for a product
   */
  async getCrossBranchAvailability(productId?: string, branchId?: string): Promise<{
    availability: Array<{
      branch: {
        id: string;
        name: string;
        code: string;
        address: string;
        phone: string;
      };
      product: {
        id: string;
        name: string;
        sku: string;
      };
      stock_info: {
        available_quantity: number;
        stock_quantity: number;
        reserved_quantity: number;
        is_available: boolean;
        is_low_stock: boolean;
        last_restock_date?: string;
      };
      status: string;
    }>;
    summary: {
      total_branches: number;
      branches_with_stock: number;
      branches_low_stock: number;
      branches_out_of_stock: number;
      total_available_quantity: number;
    };
  }> {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', productId);
    if (branchId) params.append('branch_id', branchId);

    const response = await axios.get(`${API_BASE_URL}/inventory/cross-branch-availability?${params}`);
    return response.data;
  }

  /**
   * Get immediate stock alerts
   */
  async getImmediateAlerts(): Promise<{
    alerts: StockAlert[];
    summary: {
      total_alerts: number;
      critical_alerts: number;
      warning_alerts: number;
      info_alerts: number;
      action_required: number;
    };
    timestamp: string;
  }> {
    const response = await axios.get(`${API_BASE_URL}/inventory/low-stock-alerts`);
    return response.data;
  }

  /**
   * Update stock quantity
   */
  async updateStockQuantity(
    branchStockId: string | number, 
    updateData: StockUpdateRequest
  ): Promise<{
    message: string;
    branch_stock: InventoryItem;
    change: {
      old_quantity: number;
      new_quantity: number;
      difference: number;
    };
  }> {
    // Ensure branchStockId is a number (convert string to number)
    const id = typeof branchStockId === 'string' ? parseInt(branchStockId, 10) : branchStockId;
    
    console.log('Calling updateStockQuantity API:', {
      branchStockId: id,
      updateData,
      url: `${API_BASE_URL}/branch-stock/${id}`
    });
    
    try {
      const response = await axios.put(`${API_BASE_URL}/branch-stock/${id}`, updateData);
      console.log('Update stock API response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Update stock API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: `${API_BASE_URL}/branch-stock/${id}`
      });
      throw error;
    }
  }

  /**
   * Request stock transfer
   */
  async requestStockTransfer(transferData: StockTransferRequest): Promise<{
    message: string;
    transfer: StockTransfer;
  }> {
    const response = await axios.post(`${API_BASE_URL}/inventory/stock-transfer-request`, transferData);
    return response.data;
  }

  /**
   * Get stock transfer history
   */
  async getStockTransferHistory(): Promise<{
    transfers: StockTransfer[];
    summary: {
      total_transfers: number;
      pending_transfers: number;
      completed_transfers: number;
      rejected_transfers: number;
    };
  }> {
    const response = await axios.get(`${API_BASE_URL}/inventory/stock-transfers`);
    return response.data;
  }

  /**
   * Process stock transfer (approve/reject)
   */
  async processStockTransfer(
    transferId: string, 
    action: 'approve' | 'reject', 
    notes?: string
  ): Promise<{
    message: string;
    transfer: StockTransfer;
  }> {
    const response = await axios.put(`${API_BASE_URL}/inventory/stock-transfers/${transferId}/process`, {
      action,
      notes
    });
    return response.data;
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(): Promise<{
    low_stock_items: InventoryItem[];
    count: number;
  }> {
    const response = await axios.get(`${API_BASE_URL}/branch-stock/low-stock`);
    return response.data;
  }

  /**
   * Get product availability across branches
   */
  async getProductAvailability(productId: string): Promise<{
    product: {
      id: string;
      name: string;
      sku: string;
    };
    availability: Array<{
      branch: {
        id: string;
        name: string;
        code: string;
      };
      available_quantity: number;
      stock_quantity: number;
      reserved_quantity: number;
    }>;
    total_available: number;
    branches_with_stock: number;
  }> {
    const response = await axios.get(`${API_BASE_URL}/branch-stock/products/${productId}/availability`);
    return response.data;
  }

  /**
   * Get branch stock for a specific branch
   */
  async getBranchStock(branchId: string): Promise<{
    branch: {
      id: string;
      name: string;
      code: string;
    };
    stock: InventoryItem[];
    summary: {
      total_products: number;
      in_stock: number;
      low_stock: number;
      out_of_stock: number;
    };
  }> {
    const response = await axios.get(`${API_BASE_URL}/branches/${branchId}/stock`);
    return response.data;
  }

  /**
   * Get all branch stock (Admin only)
   */
  async getAllBranchStock(): Promise<{
    stock: InventoryItem[];
    summary: {
      total_products: number;
      in_stock: number;
      low_stock: number;
      out_of_stock: number;
    };
  }> {
    const response = await axios.get(`${API_BASE_URL}/branch-stock`);
    return response.data;
  }
}

export const inventoryApiService = new InventoryApiService();
