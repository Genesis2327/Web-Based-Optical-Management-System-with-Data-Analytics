import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl, getAuthHeaders } from '@/config/api';

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_paths?: string[];
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface RestockRequest {
  id: number;
  branch_id: number;
  product_id: number;
  requested_by: number;
  current_stock: number;
  requested_quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  notes?: string;
  approved_by?: number;
  approved_at?: string;
  fulfilled_at?: string;
  created_at: string;
  product: Product;
  branch: Branch;
  requestedBy: User;
  approvedBy?: User;
}

interface BranchStock {
  id: number;
  product_id: number;
  branch_id: number;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  product: Product;
  branch: Branch;
}

const StaffRestockRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [lowStockItems, setLowStockItems] = useState<BranchStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<BranchStock | null>(null);
  const [requestQuantity, setRequestQuantity] = useState<number>(0);
  const [requestNotes, setRequestNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchRequests();
    fetchLowStockItems();
  }, [selectedStatus]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = getApiUrl('/restock-requests');
      if (selectedStatus !== 'all') {
        url += `?status=${selectedStatus}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch restock requests');
      }

      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to load restock requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStockItems = async () => {
    try {
      const response = await fetch(getApiUrl('/branch-stock/low-stock'), {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch low stock items');
      }

      const data = await response.json();
      setLowStockItems(data.low_stock_items || []);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || requestQuantity <= 0) {
      alert('Please select a product and enter a valid quantity');
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch(getApiUrl('/restock-requests'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          product_id: selectedProduct.product_id,
          requested_quantity: requestQuantity,
          notes: requestNotes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create restock request');
      }

      // Refresh data
      await fetchRequests();
      await fetchLowStockItems();
      
      // Reset form
      setShowRequestModal(false);
      setSelectedProduct(null);
      setRequestQuantity(0);
      setRequestNotes('');
      
      alert('Restock request created successfully!');
    } catch (error) {
      console.error('Error creating request:', error);
      alert(error instanceof Error ? error.message : 'Failed to create restock request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'fulfilled': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStorageUrl = (path: string) => {
    const apiBaseUrl = getApiUrl('/');
    const baseUrl = apiBaseUrl.replace('/api', '');
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${baseUrl}/storage/${cleanPath}`;
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2">Loading restock requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Restock Requests</h2>
        <button
          onClick={() => setShowRequestModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Request Restock
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Low Stock Alert</h3>
          <p className="text-sm text-yellow-700 mb-3">
            The following items are running low on stock:
          </p>
          <div className="space-y-2">
            {lowStockItems.slice(0, 3).map(item => (
              <div key={item.id} className="text-sm text-yellow-700">
                • {item.product.name} - {item.available_quantity} available
              </div>
            ))}
            {lowStockItems.length > 3 && (
              <div className="text-sm text-yellow-700">
                ... and {lowStockItems.length - 3} more items
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="mb-6">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Requests</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No restock requests found.</p>
          </div>
        ) : (
          requests.map(request => (
            <div key={request.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start space-x-4">
                {/* Product Image */}
                <div className="flex-shrink-0">
                  {request.product.image_paths && request.product.image_paths.length > 0 ? (
                    <img
                      src={getStorageUrl(request.product.image_paths[0])}
                      alt={request.product.name}
                      className="w-16 h-16 object-cover rounded border"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded border flex items-center justify-center text-gray-500 text-xs">
                      No Image
                    </div>
                  )}
                </div>

                {/* Request Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{request.product.name}</h3>
                      <p className="text-gray-600 text-sm mb-2">{request.product.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Current Stock:</span> {request.current_stock}
                        </div>
                        <div>
                          <span className="font-medium">Requested:</span> {request.requested_quantity}
                        </div>
                        <div>
                          <span className="font-medium">Requested By:</span> {request.requestedBy.name}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span> {formatDate(request.created_at)}
                        </div>
                      </div>

                      {request.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <span className="font-medium">Notes:</span> {request.notes}
                        </div>
                      )}

                      {request.approvedBy && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Approved by:</span> {request.approvedBy.name} on {formatDate(request.approved_at!)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Request Restock</h3>
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setSelectedProduct(null);
                    setRequestQuantity(0);
                    setRequestNotes('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="space-y-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Product *
                  </label>
                  <select
                    value={selectedProduct?.id || ''}
                    onChange={(e) => {
                      const product = lowStockItems.find(item => item.id === Number(e.target.value));
                      setSelectedProduct(product || null);
                      setRequestQuantity(0);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Choose a product...</option>
                    {lowStockItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.product.name} - Current: {item.available_quantity}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requested Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={requestQuantity}
                    onChange={(e) => setRequestQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any additional information..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      setSelectedProduct(null);
                      setRequestQuantity(0);
                      setRequestNotes('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedProduct}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffRestockRequests;
