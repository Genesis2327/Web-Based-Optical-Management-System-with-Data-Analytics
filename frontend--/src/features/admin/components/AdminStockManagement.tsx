import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Branch {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  brand: string;
  image_url: string;
}

interface BranchStock {
  id: number;
  product_id: number;
  branch_id: number;
  stock_quantity: number;
  reserved_quantity: number;
  product: Product;
  branch: Branch;
}

const AdminStockManagement: React.FC = () => {
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<{ [key: string]: number }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBranchStock();
  }, []);

  const fetchBranchStock = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/branch-stock', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranchStock(data.stock || []);
      } else {
        toast.error('Failed to fetch branch stock data');
      }
    } catch (error) {
      toast.error('Failed to fetch branch stock data');
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (stockId: number, newQuantity: number) => {
    setEditingStock(prev => ({
      ...prev,
      [stockId]: newQuantity
    }));
  };

  const handleSaveStock = async (stock: BranchStock) => {
    const newQuantity = editingStock[stock.id];
    // Allow 0 as a valid quantity - only reject undefined or negative values
    if (newQuantity === undefined || isNaN(newQuantity) || newQuantity < 0) {
      toast.error('Please enter a valid quantity (0 or greater)');
      return;
    }

    const stockQuantity = parseInt(String(newQuantity), 10);
    
    setSaving(true);
    try {
      console.log('Updating stock:', {
        stockId: stock.id,
        productId: stock.product_id,
        branchId: stock.branch_id,
        newQuantity: stockQuantity
      });

      // Use the proper endpoint with route model binding
      const token = localStorage.getItem('token') || sessionStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
      
      const response = await fetch(`${apiBaseUrl}/branch-stock/${stock.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          stock_quantity: stockQuantity,
          reason: 'Updated from product management'
        })
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log('Stock updated successfully:', responseData);
        toast.success('Stock updated successfully');
        fetchBranchStock();
        setEditingStock(prev => {
          const newState = { ...prev };
          delete newState[stock.id];
          return newState;
        });
      } else {
        console.error('Stock update failed:', responseData);
        toast.error(responseData.message || responseData.error || 'Failed to update stock');
      }
    } catch (error: any) {
      console.error('Error updating stock:', error);
      toast.error(error.message || 'Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const getStockStatus = (stock: BranchStock) => {
    const available = stock.stock_quantity - stock.reserved_quantity;
    if (available <= 0) return 'out-of-stock';
    if (available <= 5) return 'low-stock';
    return 'in-stock';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out-of-stock':
        return 'text-red-600 bg-red-100';
      case 'low-stock':
        return 'text-yellow-600 bg-yellow-100';
      case 'in-stock':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'out-of-stock':
        return <TrendingDown className="w-4 h-4" />;
      case 'low-stock':
        return <AlertTriangle className="w-4 h-4" />;
      case 'in-stock':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
        <button
          onClick={fetchBranchStock}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reserved
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Available
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {branchStock.map((stock) => {
                const status = getStockStatus(stock);
                const available = stock.stock_quantity - stock.reserved_quantity;
                const isEditing = editingStock[stock.id] !== undefined;
                
                return (
                  <tr key={stock.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {stock.product.image_url ? (
                            <img
                              className="h-10 w-10 rounded-lg object-cover"
                              src={stock.product.image_url}
                              alt={stock.product.name}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">No Image</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {stock.product.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {stock.product.brand}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stock.branch.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={editingStock[stock.id]}
                          onChange={(e) => handleStockChange(stock.id, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">
                          {stock.stock_quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stock.reserved_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {available}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockStatusColor(status)}`}
                      >
                        {getStockStatusIcon(status)}
                        <span className="ml-1 capitalize">
                          {status.replace('-', ' ')}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveStock(stock)}
                          disabled={saving}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingStock(prev => ({
                            ...prev,
                            [stock.id]: stock.stock_quantity
                          }))}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {branchStock.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">No stock data available</div>
          <div className="text-gray-400 text-sm mt-2">
            Add some products and set their stock levels across branches
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStockManagement;

