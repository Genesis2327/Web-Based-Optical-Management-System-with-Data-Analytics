import React, { useState, useEffect } from 'react';
import { X, Package, Save, Building2, Minus, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBranches } from '@/services/branchApi';
import { useQuery } from '@tanstack/react-query';

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface StockData {
  branchId: number;
  branchName: string;
  branchCode: string;
  stockQuantity: number;
}

interface StockManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    name: string;
    stock_quantity: number;
    total_stock?: number;
  };
  onSave: (stockData: StockData[]) => Promise<void>;
}

export const StockManagementModal: React.FC<StockManagementModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave
}) => {
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [saving, setSaving] = useState(false);
  const [totalStock, setTotalStock] = useState(0);

  // Fetch branches dynamically from the API
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    enabled: isOpen, // Only fetch when modal is open
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Initialize stock data when modal opens or branches are loaded
  useEffect(() => {
    if (isOpen && branches.length > 0) {
      loadCurrentStock();
    }
  }, [isOpen, product.id, branches]);

  const loadCurrentStock = async () => {
    if (branches.length === 0) {
      initializeWithZeroStock([]);
      return;
    }

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      const token = sessionStorage.getItem('auth_token');
      
      if (!token) {
        console.warn('No auth token found');
        initializeWithZeroStock(branches);
        return;
      }

      // Fetch current branch stock for this product
      const response = await fetch(`${apiBaseUrl}/branch-stock-test`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const productStock = data.stock?.filter((s: any) => s.product_id === product.id) || [];
        
        // Initialize stock data with current values using branches from API
        const initialStockData = branches.map(branch => {
          const existingStock = productStock.find((s: any) => s.branch_id === branch.id);
          return {
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code || '',
            stockQuantity: existingStock?.stock_quantity || 0
          };
        });
        
        setStockData(initialStockData);
        setTotalStock(initialStockData.reduce((total, item) => total + item.stockQuantity, 0));
      } else {
        console.warn('Failed to load current stock, initializing with zeros');
        initializeWithZeroStock(branches);
      }
    } catch (error) {
      console.error('Error loading current stock:', error);
      initializeWithZeroStock(branches);
    }
  };

  const initializeWithZeroStock = (branchesList: Branch[]) => {
    if (branchesList.length === 0) {
      setStockData([]);
      setTotalStock(0);
      return;
    }

    const initialStockData = branchesList.map(branch => ({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code || '',
      stockQuantity: 0
    }));
    setStockData(initialStockData);
    setTotalStock(0);
  };

  const handleStockChange = (branchId: number, value: string) => {
    const quantity = Math.max(0, parseInt(value) || 0);
    setStockData(prev => 
      prev.map(item => 
        item.branchId === branchId 
          ? { ...item, stockQuantity: quantity }
          : item
      )
    );
    
    // Update total
    const newTotal = stockData.reduce((total, item) => 
      total + (item.branchId === branchId ? quantity : item.stockQuantity), 0
    );
    setTotalStock(newTotal);
  };

  const adjustStock = (branchId: number, delta: number) => {
    const currentStock = stockData.find(item => item.branchId === branchId)?.stockQuantity || 0;
    const newQuantity = Math.max(0, currentStock + delta);
    handleStockChange(branchId, newQuantity.toString());
  };

  const setAllToZero = () => {
    setStockData(prev => 
      prev.map(item => ({
        ...item,
        stockQuantity: 0
      }))
    );
    setTotalStock(0);
  };

  const setAllToTen = () => {
    const newStockData = stockData.map(item => ({
      ...item,
      stockQuantity: 10
    }));
    setStockData(newStockData);
    setTotalStock(newStockData.reduce((total, item) => total + item.stockQuantity, 0));
  };

  const setAllToAmount = (amount: number) => {
    const newStockData = stockData.map(item => ({
      ...item,
      stockQuantity: amount
    }));
    setStockData(newStockData);
    setTotalStock(newStockData.reduce((total, item) => total + item.stockQuantity, 0));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(stockData);
      toast.success('Stock updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Show loading state while branches are being fetched
  if (branchesLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full p-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700">Loading branches...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no branches are available
  if (branches.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full p-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Branches Available</h2>
            <p className="text-gray-600 mb-4">Please create branches in the Branch Management section first.</p>
            <Button onClick={onClose} variant="outline">Close</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />
                Manage Stock
              </h2>
              <p className="text-gray-600 mt-1 font-medium">{product.name}</p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Quick Actions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Total Stock:</label>
                  <Input
                    type="number"
                    min="0"
                    value={totalStock}
                    onChange={(e) => setTotalStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={setAllToZero}
                    variant="outline"
                    size="sm"
                    className="text-gray-600 hover:text-gray-700"
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={setAllToTen}
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    All to 10
                  </Button>
                  <Button
                    onClick={() => setAllToAmount(5)}
                    variant="outline"
                    size="sm"
                    className="text-purple-600 hover:text-purple-700"
                  >
                    All to 5
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branch Stock Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stockData.map((branch) => (
              <Card key={branch.branchId} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="text-gray-900">{branch.branchName}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {branch.branchCode}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Current Stock Display */}
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Current Stock</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {branch.stockQuantity}
                      </div>
                    </div>
                    
                    {/* Stock Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => adjustStock(branch.branchId, -1)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        min="0"
                        value={branch.stockQuantity}
                        onChange={(e) => handleStockChange(branch.branchId, e.target.value)}
                        className="text-center font-semibold"
                        placeholder="0"
                      />
                      
                      <Button
                        onClick={() => adjustStock(branch.branchId, 1)}
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={saving}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Stock
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
