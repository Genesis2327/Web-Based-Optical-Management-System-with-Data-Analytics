import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle, Clock, ShoppingBag, Eye, MapPin, Box } from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '@/config/api';
import { getProductOrdersByPatient, ProductOrder } from '@/services/productTrackingApi';

interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  total: number;
}

interface ProductOrder {
  id: string;
  receipt_number: string;
  receipt_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  status: 'ordered' | 'processing' | 'ready_for_pickup' | 'delivered';
  branch?: {
    id: number;
    name: string;
    address?: string;
  };
  receipt_date: string;
  appointment_date?: string;
}

const CustomerProductTracking: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [glassOrders, setGlassOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductOrder | null>(null);
  const [selectedGlassOrder, setSelectedGlassOrder] = useState<ProductOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'glass-orders'>('glass-orders');

  useEffect(() => {
    if (user?.id) {
      fetchProductOrders();
      fetchGlassOrders();
    }
  }, [user]);

  const fetchProductOrders = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch receipts for the customer
      const response = await fetch(`${getApiUrl(`/customers/${user.id}/receipts`)}`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load receipts');
      }

      const data = await response.json();
      const receipts = data.data || [];
      
      // Extract product orders from receipt items (exclude Eye Examination and glass-related items)
      const productOrders: ProductOrder[] = [];
      
      receipts.forEach((receipt: any) => {
        if (receipt.items && Array.isArray(receipt.items)) {
          receipt.items.forEach((item: ReceiptItem) => {
            // Skip Eye Refraction and glass-related items (those go to Glass Orders)
            const description = item.description.toLowerCase();
            if (
              description.includes('eye refraction') ||
              description.includes('eye examination') ||
              description.includes('eye exam') ||
              description.includes('frame') ||
              description.includes('lens') ||
              description.includes('eyeglass') ||
              description.includes('spectacle')
            ) {
              return; // Skip this item
            }
            
            // Determine status based on receipt
            let status: ProductOrder['status'] = 'ordered';
            if (receipt.payment_status === 'paid') {
              status = 'processing';
            }
            // You can add more status logic here based on your business rules
            
            productOrders.push({
              id: `receipt-${receipt.id}-item-${item.description}`,
              receipt_number: receipt.receipt_number || `REC-${receipt.id}`,
              receipt_id: receipt.id,
              product_name: item.description,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              status: status,
              branch: receipt.branch || receipt.appointment?.branch,
              receipt_date: receipt.created_at || receipt.date,
              appointment_date: receipt.appointment?.appointment_date,
            });
          });
        }
      });
      
      setOrders(productOrders);
      
      if (productOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(productOrders[0]);
      }
    } catch (error) {
      console.error('Error fetching product orders:', error);
      setError('Failed to load your product orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ProductOrder['status']) => {
    switch (status) {
      case 'ordered':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'ready_for_pickup':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: ProductOrder['status']) => {
    switch (status) {
      case 'ready_for_pickup':
        return <CheckCircle className="h-4 w-4" />;
      case 'delivered':
        return <Package className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: ProductOrder['status']) => {
    switch (status) {
      case 'ordered':
        return 'Ordered';
      case 'processing':
        return 'Processing';
      case 'ready_for_pickup':
        return 'Ready for Pickup';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
  };

  const fetchGlassOrders = async () => {
    if (!user?.id) return;
    
    try {
      const orders = await getProductOrdersByPatient(user.id);
      setGlassOrders(orders);
      if (orders.length > 0 && !selectedGlassOrder) {
        setSelectedGlassOrder(orders[0]);
      }
    } catch (error) {
      console.error('Error fetching glass orders:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Horizontal Progress Indicator for Glass Orders (like the image)
  const renderHorizontalProgress = (order: ProductOrder) => {
    // Define the three main stages
    const stages = [
      { 
        key: 'ordered', 
        label: 'Order Placed', 
        icon: ShoppingBag,
        statuses: ['Pending Confirmation', 'For Manufacturing']
      },
      { 
        key: 'production', 
        label: 'In Production', 
        icon: Box,
        statuses: ['In Production', 'Assembly / Quality Check']
      },
      { 
        key: 'pickup', 
        label: 'Ready for Pickup', 
        icon: MapPin,
        statuses: ['Ready for Pickup', 'Delivered']
      }
    ];

    // Determine which stage the order is at
    const getCurrentStage = () => {
      if (order.status === 'Ready for Pickup' || order.status === 'Delivered') {
        return 2; // Pickup stage
      } else if (order.status === 'In Production' || order.status === 'Assembly / Quality Check') {
        return 1; // Production stage
      } else {
        return 0; // Ordered stage
      }
    };

    const currentStage = getCurrentStage();
    const isCompleted = order.status === 'Delivered';

    return (
      <div className="flex items-center justify-between w-full py-4">
        {stages.map((stage, index) => {
          const StageIcon = stage.icon;
          const isActive = index <= currentStage;
          const isCurrent = index === currentStage && !isCompleted;
          
          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isActive 
                    ? 'bg-green-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  <StageIcon className="w-6 h-6" />
                </div>
                <div className={`mt-2 text-xs font-medium text-center ${
                  isActive ? 'text-green-700' : 'text-gray-400'
                }`}>
                  {stage.label}
                </div>
                {isCurrent && (
                  <div className="mt-1 text-xs text-blue-600 font-semibold">
                    Current
                  </div>
                )}
              </div>
              {index < stages.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  isActive ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderTimeline = (order: ProductOrder) => {
    const statuses: ProductOrder['status'][] = ['ordered', 'processing', 'ready_for_pickup', 'delivered'];
    const currentIndex = statuses.indexOf(order.status);

    return (
      <div className="space-y-4">
        {statuses.map((status, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={status} className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                  ? 'bg-blue-500 text-white border-2 border-blue-300'
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className={`font-semibold ${
                  isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-400'
                }`}>
                  {getStatusLabel(status)}
                </div>
                {isCurrent && (
                  <div className="text-sm text-gray-600 mt-1">Current Status</div>
                )}
                {index < statuses.length - 1 && (
                  <div className={`h-8 w-0.5 mt-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading your product orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">You don't have any product orders yet.</p>
        <p className="text-gray-400 text-sm mt-2">Product orders will appear here after you purchase products and receive a receipt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('glass-orders')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'glass-orders'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Glass Orders ({glassOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'products'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Product Orders ({orders.length})
          </button>
        </nav>
      </div>

      {/* Glass Orders Tab */}
      {activeTab === 'glass-orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Glass Orders List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Glass Orders</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {glassOrders.length === 0 ? (
                  <div className="p-8 text-center">
                    <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">No glass orders yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {glassOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedGlassOrder(order)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                          selectedGlassOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {order.formatted_number}
                          </span>
                          <Badge className={`${
                            order.status === 'Ready for Pickup' ? 'bg-green-100 text-green-800' :
                            order.status === 'Delivered' ? 'bg-gray-100 text-gray-800' :
                            order.status === 'In Production' || order.status === 'Assembly / Quality Check' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status === 'Ready for Pickup' || order.status === 'Delivered' ? 
                              <CheckCircle className="h-4 w-4" /> : 
                              <Clock className="h-4 w-4" />}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600">
                          {order.glass_specifications?.lens_type || 'Standard'} • {order.glass_specifications?.frame_material || 'Frame'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(order.created_at)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Glass Order Details */}
          {selectedGlassOrder && (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Glass Order {selectedGlassOrder.formatted_number}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedGlassOrder.glass_specifications?.lens_type || 'Standard Lens'} • {selectedGlassOrder.glass_specifications?.frame_material || 'Frame'}
                      </p>
                    </div>
                    <Badge className={`${
                      selectedGlassOrder.status === 'Ready for Pickup' ? 'bg-green-100 text-green-800' :
                      selectedGlassOrder.status === 'Delivered' ? 'bg-gray-100 text-gray-800' :
                      selectedGlassOrder.status === 'In Production' || selectedGlassOrder.status === 'Assembly / Quality Check' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedGlassOrder.status === 'Ready for Pickup' || selectedGlassOrder.status === 'Delivered' ? 
                        <CheckCircle className="h-4 w-4" /> : 
                        <Clock className="h-4 w-4" />}
                      <span className="ml-2">{selectedGlassOrder.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Ready for Pickup Alert */}
                  {selectedGlassOrder.status === 'Ready for Pickup' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <span className="font-semibold text-green-900">Ready for Pickup!</span>
                      </div>
                      <p className="text-sm text-green-800">
                        Your glass order is ready for pickup at <strong>{selectedGlassOrder.branch?.name || 'the branch'}</strong>
                      </p>
                      {selectedGlassOrder.branch?.address && (
                        <p className="text-sm text-green-700 mt-1">{selectedGlassOrder.branch.address}</p>
                      )}
                    </div>
                  )}

                  {/* Horizontal Progress Indicator */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4">Order Progress</h3>
                    {renderHorizontalProgress(selectedGlassOrder)}
                  </div>

                  {/* Glass Specifications */}
                  {selectedGlassOrder.glass_specifications && (
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-3">Glass Specifications</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {selectedGlassOrder.glass_specifications.lens_type && (
                          <div>
                            <span className="text-gray-600">Lens Type:</span>
                            <p className="font-medium">{selectedGlassOrder.glass_specifications.lens_type}</p>
                          </div>
                        )}
                        {selectedGlassOrder.glass_specifications.lens_material && (
                          <div>
                            <span className="text-gray-600">Lens Material:</span>
                            <p className="font-medium">{selectedGlassOrder.glass_specifications.lens_material}</p>
                          </div>
                        )}
                        {selectedGlassOrder.glass_specifications.frame_material && (
                          <div>
                            <span className="text-gray-600">Frame Material:</span>
                            <p className="font-medium">{selectedGlassOrder.glass_specifications.frame_material}</p>
                          </div>
                        )}
                        {selectedGlassOrder.glass_specifications.lens_coating && (
                          <div>
                            <span className="text-gray-600">Coating:</span>
                            <p className="font-medium">{selectedGlassOrder.glass_specifications.lens_coating}</p>
                          </div>
                        )}
                      </div>
                      {(selectedGlassOrder.glass_specifications.blue_light_filter || 
                        selectedGlassOrder.glass_specifications.progressive_lens) && (
                        <div className="mt-3">
                          <span className="text-gray-600 text-sm">Special Features: </span>
                          <div className="flex gap-2 mt-1">
                            {selectedGlassOrder.glass_specifications.blue_light_filter && (
                              <Badge variant="secondary">Blue Light Filter</Badge>
                            )}
                            {selectedGlassOrder.glass_specifications.progressive_lens && (
                              <Badge variant="secondary">Progressive Lens</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Info */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Order Date:</span>
                        <p className="font-medium">{formatDate(selectedGlassOrder.created_at)}</p>
                      </div>
                      {selectedGlassOrder.branch && (
                        <div>
                          <span className="text-gray-600">Branch:</span>
                          <p className="font-medium">{selectedGlassOrder.branch.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Product Orders Tab */}
      {activeTab === 'products' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Product Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                      selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {order.product_name}
                      </span>
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusIcon(order.status)}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600">
                      Qty: {order.quantity} • {order.receipt_number}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(order.receipt_date)}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Details */}
        {selectedOrder && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedOrder.product_name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Receipt: {selectedOrder.receipt_number}</p>
                  </div>
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {getStatusIcon(selectedOrder.status)}
                    <span className="ml-2">{getStatusLabel(selectedOrder.status)}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ready for Pickup Alert */}
                {selectedOrder.status === 'ready_for_pickup' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-semibold text-green-900">Ready for Pickup!</span>
                    </div>
                    <p className="text-sm text-green-800">
                      Your order is ready for pickup at <strong>{selectedOrder.branch?.name || 'the branch'}</strong>
                    </p>
                    {selectedOrder.branch?.address && (
                      <p className="text-sm text-green-700 mt-1">{selectedOrder.branch.address}</p>
                    )}
                  </div>
                )}

                {/* Order Details */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Order Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Quantity:</span>
                      <p className="font-medium">{selectedOrder.quantity}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit Price:</span>
                      <p className="font-medium">₱{selectedOrder.price.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <p className="font-medium">₱{selectedOrder.total.toFixed(2)}</p>
                    </div>
                    {selectedOrder.branch && (
                      <div>
                        <span className="text-gray-600">Branch:</span>
                        <p className="font-medium">{selectedOrder.branch.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Order Progress</h3>
                  {renderTimeline(selectedOrder)}
                </div>

                {/* Dates */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Order Date:</span>
                      <p className="font-medium">{formatDate(selectedOrder.receipt_date)}</p>
                    </div>
                    {selectedOrder.appointment_date && (
                      <div>
                        <span className="text-gray-600">Appointment Date:</span>
                        <p className="font-medium">{formatDate(selectedOrder.appointment_date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default CustomerProductTracking;
