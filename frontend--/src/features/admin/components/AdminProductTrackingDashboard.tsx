import React, { useState, useEffect } from 'react';
import {
  getProductOrders,
  updateProductOrderStatus,
  ProductOrder,
  ProductOrderStatus,
  ProductOrdersFilters,
} from '../../../services/productTrackingApi';
import { getApiUrl, getAuthHeaders } from '@/config/api';

interface Branch {
  id: number;
  name: string;
}

const AdminProductTrackingDashboard: React.FC = () => {
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductOrdersFilters>({});
  const [selectedOrder, setSelectedOrder] = useState<ProductOrder | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ProductOrderStatus | ''>('');
  const [statusNotes, setStatusNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchBranches = async () => {
    try {
      const response = await fetch(getApiUrl('/branches'), {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBranches(data.data || data);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProductOrders(filters);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load product orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: number, status: ProductOrderStatus, notes?: string) => {
    try {
      setActionLoading(orderId);
      await updateProductOrderStatus(orderId, { status, notes });
      await fetchOrders();
      setShowStatusModal(false);
      setNewStatus('');
      setStatusNotes('');
      alert('Order status updated successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const openStatusModal = (order: ProductOrder) => {
    setSelectedOrder(order);
    setNewStatus('');
    setStatusNotes('');
    setShowStatusModal(true);
  };

  const getStatusColor = (status: ProductOrderStatus) => {
    switch (status) {
      case 'Pending Confirmation':
        return 'bg-yellow-100 text-yellow-800';
      case 'For Manufacturing':
        return 'bg-blue-100 text-blue-800';
      case 'In Production':
        return 'bg-purple-100 text-purple-800';
      case 'Assembly / Quality Check':
        return 'bg-indigo-100 text-indigo-800';
      case 'Ready for Pickup':
        return 'bg-green-100 text-green-800';
      case 'Delivered':
        return 'bg-gray-100 text-gray-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Order Management</h1>
        <p className="text-gray-600">View and manage all product orders across branches</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={filters.branch_id || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  branch_id: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value ? (e.target.value as ProductOrderStatus) : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {([
                'Pending Confirmation',
                'For Manufacturing',
                'In Production',
                'Assembly / Quality Check',
                'Ready for Pickup',
                'Delivered',
                'Cancelled',
              ] as ProductOrderStatus[]).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  date_from: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  date_to: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.formatted_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.branch?.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.patient?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{order.patient?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openStatusModal(order)}
                        disabled={actionLoading === order.id}
                        className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Update Status - {selectedOrder.formatted_number}
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ProductOrderStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select status...</option>
                  {selectedOrder.available_next_statuses?.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add notes about this status change..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedOrder(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newStatus) {
                      handleStatusUpdate(selectedOrder.id, newStatus, statusNotes || undefined);
                    }
                  }}
                  disabled={!newStatus || actionLoading === selectedOrder.id}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {actionLoading === selectedOrder.id ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductTrackingDashboard;

