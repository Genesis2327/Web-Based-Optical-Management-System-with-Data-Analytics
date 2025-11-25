import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl, getAuthHeaders } from '@/config/api';

interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
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

interface Reservation {
  id: number;
  user_id: number;
  product_id: number;
  branch_id: number;
  quantity: number;
  reservation_fee?: number;
  total_amount?: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  notes?: string;
  reserved_at: string;
  approved_at?: string;
  rejected_at?: string;
  completed_at?: string;
  user: User;
  product: Product;
  branch: Branch;
}

const StaffReservationDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchReservations();
  }, [selectedStatus]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = getApiUrl('/reservations');
      if (selectedStatus !== 'all') {
        url += `?status=${selectedStatus}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reservations');
      }

      const data = await response.json();
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      setError('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleReservationAction = async (reservationId: number, action: 'approve' | 'reject' | 'complete') => {
    try {
      setActionLoading(reservationId);
      
      const response = await fetch(getApiUrl(`/reservations/${reservationId}/${action}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} reservation`);
      }

      // Refresh reservations
      await fetchReservations();
      
      // Show success message
      alert(`Reservation ${action}d successfully!`);
    } catch (error) {
      console.error(`Error ${action}ing reservation:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${action} reservation`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusActions = (reservation: Reservation) => {
    switch (reservation.status) {
      case 'pending':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleReservationAction(reservation.id, 'approve')}
              disabled={actionLoading === reservation.id}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {actionLoading === reservation.id ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={() => handleReservationAction(reservation.id, 'reject')}
              disabled={actionLoading === reservation.id}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:bg-gray-400"
            >
              {actionLoading === reservation.id ? 'Processing...' : 'Reject'}
            </button>
          </div>
        );
      case 'approved':
        return (
          <button
            onClick={() => handleReservationAction(reservation.id, 'complete')}
            disabled={actionLoading === reservation.id}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {actionLoading === reservation.id ? 'Processing...' : 'Mark Complete'}
          </button>
        );
      default:
        return <span className="text-gray-500 text-sm">No actions available</span>;
    }
  };

  const getStorageUrl = (path: string) => {
    const apiBaseUrl = getApiUrl('/');
    const baseUrl = apiBaseUrl.replace('/api', '');
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${baseUrl}/storage/${cleanPath}`;
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

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2">Loading reservations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Branch Reservations</h2>
        <div className="text-sm text-gray-600">
          {user?.branch?.name || 'Your Branch'}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Status Filter */}
      <div className="mb-6">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Reservations</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        {reservations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No reservations found for your branch.</p>
          </div>
        ) : (
          reservations.map(reservation => (
            <div key={reservation.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start space-x-4">
                {/* Product Image */}
                <div className="flex-shrink-0">
                  {reservation.product.image_paths && reservation.product.image_paths.length > 0 ? (
                    <img
                      src={getStorageUrl(reservation.product.image_paths[0])}
                      alt={reservation.product.name}
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

                {/* Reservation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{reservation.product.name}</h3>
                      <p className="text-gray-600 text-sm mb-2">{reservation.product.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Customer:</span> {reservation.user.name}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {reservation.user.email}
                        </div>
                        <div>
                          <span className="font-medium">Quantity:</span> {reservation.quantity}
                        </div>
                        <div>
                          <span className="font-medium">Unit Price:</span> P {Number(reservation.product.price).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Product Total:</span> P {(reservation.quantity * Number(reservation.product.price)).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Reservation Fee:</span> P {(reservation.reservation_fee ?? 150).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Total Amount:</span> <span className="font-bold text-green-600">P {(reservation.total_amount ?? (reservation.quantity * Number(reservation.product.price) + (reservation.reservation_fee ?? 150))).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="font-medium">Reserved:</span> {formatDate(reservation.reserved_at)}
                        </div>
                      </div>

                      {reservation.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <span className="font-medium">Notes:</span> {reservation.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                        {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                      </span>
                      {getStatusActions(reservation)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {reservations.filter(r => r.status === 'pending').length}
          </div>
          <div className="text-sm text-yellow-700">Pending</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {reservations.filter(r => r.status === 'approved').length}
          </div>
          <div className="text-sm text-blue-700">Approved</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {reservations.filter(r => r.status === 'completed').length}
          </div>
          <div className="text-sm text-green-700">Completed</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-gray-600">
            {reservations.length}
          </div>
          <div className="text-sm text-gray-700">Total</div>
        </div>
      </div>
    </div>
  );
};

export default StaffReservationDashboard;
