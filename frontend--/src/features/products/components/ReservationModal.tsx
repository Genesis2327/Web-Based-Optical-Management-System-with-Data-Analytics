import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Product, BranchAvailability } from '../types/product.types';

interface ProductWithAvailability extends Product {
  // Product interface remains the same
}

interface ReservationModalProps {
  product: ProductWithAvailability;
  isOpen: boolean;
  onClose: () => void;
  onReservationSuccess: () => void;
}

const ReservationModal: React.FC<ReservationModalProps> = ({
  product,
  isOpen,
  onClose,
  onReservationSuccess
}) => {
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedBranch(null);
      setQuantity(1);
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const availableBranches = product.branch_availability?.filter(ba => 
    ba.is_available && 
    ba.branch && 
    ba.branch.id && 
    ba.branch.name
  ) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranch) {
      setError('Please select a branch');
      return;
    }

    if (!user) {
      setError('You must be logged in to make a reservation');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      const res = await fetch(`${API_BASE_URL}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionStorage.getItem('auth_token') ? `Bearer ${sessionStorage.getItem('auth_token')}` : ''
        },
        body: JSON.stringify({
          product_id: product.id,
          branch_id: selectedBranch,
          quantity: quantity,
          notes: notes || null,
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMessage = data?.message || data?.error || 'Failed to create reservation';
        
        // Extract validation errors if present
        if (data?.errors) {
          const validationErrors = Object.values(data.errors).flat().join(', ');
          throw new Error(validationErrors || errorMessage);
        }
        
        throw new Error(errorMessage);
      }

      onReservationSuccess();
      onClose();
      
      // Show success message
      alert('Product reserved successfully! You will be notified when it\'s ready for pickup.');
    } catch (error) {
      console.error('Reservation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create reservation');
    } finally {
      setLoading(false);
    }
  };

  const getMaxQuantity = () => {
    if (!selectedBranch) return 1;
    const branchAvailability = product.branch_availability?.find(
      ba => ba.branch && ba.branch.id === selectedBranch
    );
    return branchAvailability?.available_quantity || 1;
  };

  if (!isOpen) return null;

  // Show error if no branches are available
  if (availableBranches.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Reserve Product</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Product Not Available</h3>
            <p className="text-gray-600 mb-6">
              This product is currently not available at any branch for reservation.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Reserve Product</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Product Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">{product.name}</h3>
            <p className="text-gray-600 text-sm mb-2">{product.description}</p>
            <p className="font-bold text-blue-600">₱{Number(product.price || 0).toFixed(2)}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Branch Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Branch *
              </label>
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a branch...</option>
                {availableBranches.map(branch => (
                  branch.branch && (
                    <option key={branch.branch.id} value={branch.branch.id}>
                      {branch.branch.name} - {branch.available_quantity} available
                    </option>
                  )
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                max={getMaxQuantity()}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {getMaxQuantity()} pieces
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any special requests or notes..."
              />
            </div>

            {/* Branch Details */}
            {selectedBranch && (
              <div className="p-3 bg-blue-50 rounded-lg">
                {(() => {
                  const branchAvailability = product.branch_availability?.find(
                    ba => ba.branch && ba.branch.id === selectedBranch
                  );
                  const branch = branchAvailability?.branch;
                  
                  return branch ? (
                    <div>
                      <h4 className="font-medium text-blue-800">{branch.name}</h4>
                      <p className="text-sm text-blue-600">{branch.address}</p>
                      {branch.phone && (
                        <p className="text-sm text-blue-600">Phone: {branch.phone}</p>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedBranch}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Reserve Product'}
              </button>
            </div>
          </form>

          {/* Important Notice */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> This is a reservation only. You must visit the branch to complete your purchase and pay physically. No online payment is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationModal;
