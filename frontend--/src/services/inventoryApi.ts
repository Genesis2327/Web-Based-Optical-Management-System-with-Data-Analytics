import axios from '../lib/http';

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

export interface InventoryFilters {
  search?: string;
  status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  branch_id?: string;
  include_out_of_stock?: boolean;
  force_refresh?: boolean;
}

export interface StockUpdateRequest {
  stock_quantity: number;
  reason?: string;
}

export interface StockTransferRequest {
  product_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  reason: string;
}

class InventoryApiService {
  async getRealTimeInventory(filters: InventoryFilters = {}): Promise<{
    inventory: InventoryItem[];
    summary: any;
    timestamp: string;
    cache_expires_at: string;
  }> {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.branch_id) params.append('branch_id', filters.branch_id);
    if (filters.include_out_of_stock) params.append('include_out_of_stock', 'true');
    if (filters.force_refresh) params.append('force_refresh', 'true');

    const response = await axios.get(`/inventory/enhanced?${params}`);
    const data = response.data || {};
    const inventory = (data.inventory ?? data.inventories) || [];
    return { ...data, inventory };
  }

  async updateStockQuantity(
    branchStockId: string | number,
    updateData: StockUpdateRequest
  ): Promise<any> {
    const id = typeof branchStockId === 'string' ? parseInt(branchStockId, 10) : branchStockId;

    try {
      const response = await axios.put(`/branch-stock/${id}`, updateData);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }

  async getABCAnalysis(branchId?: string): Promise<{
    analysis: {
      A_items: any[];
      B_items: any[];
      C_items: any[];
      summary: {
        total_items: number;
        total_value: number;
        A_percentage: string;
        B_percentage: string;
        C_percentage: string;
        A_value_percentage: string;
        B_value_percentage: string;
        C_value_percentage: string;
      };
    };
    meta: {
      generated_at: string;
      branch_filtered: string | null;
      methodology: string;
    };
  }> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    const response = await axios.get(`/inventory/abc-analysis${params}`);
    return response.data;
  }

  async getABCRecommendations(branchId?: string): Promise<{
    recommendations: {
      A_items: { description: string; count: number; value_percentage: string; recommendations: string[] };
      B_items: { description: string; count: number; value_percentage: string; recommendations: string[] };
      C_items: { description: string; count: number; value_percentage: string; recommendations: string[] };
      general: { description: string; recommendations: string[] };
    };
    analysis_summary: any;
    generated_at: string;
  }> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    const response = await axios.get(`/inventory/abc-recommendations${params}`);
    return response.data;
  }

  // Additional methods...
  async getStockTransferHistory(): Promise<any> {
    const response = await axios.get('/inventory/stock-transfers');
    return response.data;
  }

  async requestStockTransfer(transferData: StockTransferRequest): Promise<any> {
    const response = await axios.post('/inventory/stock-transfer-request', transferData);
    return response.data;
  }

  async getBranchStock(branchId: string): Promise<any> {
    const response = await axios.get(`/branches/${branchId}/stock`);
    return response.data;
  }

  async getAllBranchStock(): Promise<any> {
    const response = await axios.get('/branch-stock');
    return response.data;
  }
}

export const inventoryApiService = new InventoryApiService();
