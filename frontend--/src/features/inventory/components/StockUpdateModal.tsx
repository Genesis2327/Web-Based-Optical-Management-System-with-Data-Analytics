import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { inventoryApiService } from '@/services/inventoryApi';

interface StockUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    product: {
      name: string;
      sku: string;
    };
    branch: {
      name: string;
    };
    stock: {
      stock_quantity: number;
      available_quantity: number;
      reserved_quantity: number;
    };
  };
  onStockUpdated: () => void;
}

const StockUpdateModal: React.FC<StockUpdateModalProps> = ({
  isOpen,
  onClose,
  item,
  onStockUpdated
}) => {
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewQuantity(item.stock.stock_quantity.toString());
      setReason('');
      setError(null);
    }
  }, [isOpen, item.stock.stock_quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if quantity field is empty (but allow 0)
    if (newQuantity.trim() === '' || !reason.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    const quantityNum = parseInt(newQuantity, 10);
    // Allow 0 as a valid quantity value
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('Quantity must be a non-negative number (0 or greater)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Attempting to update stock:', {
        itemId: item.id,
        newQuantity: quantityNum,
        currentQuantity: currentQuantity,
        reason: reason.trim()
      });

      const response = await inventoryApiService.updateStockQuantity(item.id, {
        stock_quantity: quantityNum,
        reason: reason.trim()
      });

      console.log('Stock update response:', response);
      console.log('Updated stock quantity:', response.branch_stock?.stock?.stock_quantity || response.branch_stock?.stock_quantity);

      if (response.branch_stock) {
        const updatedQuantity = response.branch_stock.stock?.stock_quantity || response.branch_stock.stock_quantity;
        console.log('Successfully updated to:', updatedQuantity);
      }

      // Ensure we wait a moment for cache to clear before refreshing
      await new Promise(resolve => setTimeout(resolve, 200));

      onStockUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating stock:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to update stock quantity');
    } finally {
      setLoading(false);
    }
  };

  const currentQuantity = item.stock.stock_quantity;
  const newQuantityNum = parseInt(newQuantity) || 0;
  const difference = newQuantityNum - currentQuantity;
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Update Stock Quantity
          </DialogTitle>
          <DialogDescription>
            Update stock for <strong>{item.product.name}</strong> ({item.product.sku}) at {item.branch.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Stock</Label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">{currentQuantity}</div>
                <div className="text-sm text-gray-500">
                  Available: {item.stock.available_quantity} | Reserved: {item.stock.reserved_quantity}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-quantity">New Stock Quantity *</Label>
              <Input
                id="new-quantity"
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Enter new quantity"
                required
              />
            </div>
          </div>

          {difference !== 0 && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              isIncrease ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {isIncrease ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="font-medium">
                {isIncrease ? 'Increase' : 'Decrease'} of {Math.abs(difference)} units
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Update *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're updating the stock quantity..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StockUpdateModal;



