import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, CheckCircle, AlertCircle, Eye, ShoppingBag, Box, MapPin } from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '@/config/api';

interface GlassOrder {
  id: number;
  formatted_number: string;
  status: string;
  branch?: {
    id: number;
    name: string;
    address?: string;
  };
  appointment?: {
    id: number;
    date: string;
    type: string;
  };
  glass_specifications?: {
    frame_type?: string;
    lens_type?: string;
    lens_coating?: string;
    blue_light_filter?: boolean;
    progressive_lens?: boolean;
    lens_material?: string;
    frame_material?: string;
    frame_color?: string;
    lens_color?: string;
  };
  reserved_products?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  expected_delivery_date?: string;
  sent_to_manufacturer_at?: string;
  created_at: string;
  updated_at: string;
}

const CustomerGlassOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<GlassOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<GlassOrder | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchGlassOrders();
    }
  }, [user]);

  const fetchGlassOrders = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${getApiUrl(`/glass-orders/patient/${user.id}`)}`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load glass orders');
      }

      const data = await response.json();
      console.log('Glass orders API response:', data);
      
      // Handle different response formats
      let ordersData = [];
      if (Array.isArray(data)) {
        ordersData = data;
      } else if (data.data && Array.isArray(data.data)) {
        ordersData = data.data;
      } else if (data.orders && Array.isArray(data.orders)) {
        ordersData = data.orders;
      }
      
      console.log('Processed glass orders:', ordersData);
      
      // Filter to only show actual glass orders (frames/lenses)
      // Glass orders should have glass_specifications or reserved_products that are glass-related
      const glassOrders = ordersData.filter((order: GlassOrder) => {
        // If it has glass specifications, it's a glass order
        if (order.glass_specifications && (
          order.glass_specifications.frame_type ||
          order.glass_specifications.lens_type ||
          order.glass_specifications.lens_material ||
          order.glass_specifications.frame_material
        )) {
          return true;
        }
        
        // If reserved products contain glass-related items
        if (order.reserved_products && order.reserved_products.length > 0) {
          const hasGlassProducts = order.reserved_products.some((product: any) => {
            const desc = (product.description || product.product_name || '').toLowerCase();
            return desc.includes('frame') || desc.includes('lens') || 
                   desc.includes('eyeglass') || desc.includes('spectacle');
          });
          return hasGlassProducts;
        }
        
        // If status indicates it's a manufacturing order
        return order.status && (
          order.status === 'Pending Confirmation' ||
          order.status === 'For Manufacturing' ||
          order.status === 'In Production' ||
          order.status === 'Assembly / Quality Check' ||
          order.status === 'Ready for Pickup' ||
          order.status === 'Delivered'
        );
      });
      
      console.log('Filtered glass orders:', glassOrders);
      setOrders(glassOrders);
      
      if (glassOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(glassOrders[0]);
      }
    } catch (error) {
      console.error('Error fetching glass orders:', error);
      setError('Failed to load your glass orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Ready for Pickup':
        return <CheckCircle className="h-4 w-4" />;
      case 'Delivered':
        return <Package className="h-4 w-4" />;
      case 'Cancelled':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
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
  const renderHorizontalProgress = (order: GlassOrder) => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading your glass orders...</div>
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
        <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-medium">You don't have any glass orders yet.</p>
        <p className="text-gray-400 text-sm mt-2">
          Glass orders will automatically appear here when:
        </p>
        <ul className="text-gray-400 text-sm mt-2 text-left max-w-md mx-auto space-y-1">
          <li>• You reserve a frame</li>
          <li>• A receipt is created for your reserved frame</li>
          <li>• The system automatically creates a glass order</li>
        </ul>
        <p className="text-gray-500 text-xs mt-4">
          Check the browser console (F12) for debugging information.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Glass Orders</CardTitle>
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
                      <span className="font-medium text-gray-900">
                        {order.formatted_number}
                      </span>
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusIcon(order.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.branch?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(order.created_at)}
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
                  <CardTitle>{selectedOrder.formatted_number}</CardTitle>
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {getStatusIcon(selectedOrder.status)}
                    <span className="ml-2">{selectedOrder.status}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Branch Info */}
                {selectedOrder.branch && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Pickup Location</h3>
                    <p className="text-gray-700">{selectedOrder.branch.name}</p>
                    {selectedOrder.branch.address && (
                      <p className="text-sm text-gray-600">{selectedOrder.branch.address}</p>
                    )}
                  </div>
                )}

                {/* Ready for Pickup Alert */}
                {selectedOrder.status === 'Ready for Pickup' && (
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

                {/* Horizontal Progress Indicator */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Order Progress</h3>
                  {renderHorizontalProgress(selectedOrder)}
                </div>

                {/* Expected Delivery */}
                {selectedOrder.expected_delivery_date && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Expected Delivery</h3>
                    <p className="text-gray-700">{formatDate(selectedOrder.expected_delivery_date)}</p>
                  </div>
                )}

                {/* Glass Specifications */}
                {selectedOrder.glass_specifications && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Glass Specifications</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedOrder.glass_specifications.frame_type && (
                        <div>
                          <span className="text-gray-600">Frame Type:</span>
                          <span className="ml-2 font-medium">{selectedOrder.glass_specifications.frame_type}</span>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.lens_type && (
                        <div>
                          <span className="text-gray-600">Lens Type:</span>
                          <span className="ml-2 font-medium">{selectedOrder.glass_specifications.lens_type}</span>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.lens_material && (
                        <div>
                          <span className="text-gray-600">Lens Material:</span>
                          <span className="ml-2 font-medium">{selectedOrder.glass_specifications.lens_material}</span>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.frame_material && (
                        <div>
                          <span className="text-gray-600">Frame Material:</span>
                          <span className="ml-2 font-medium">{selectedOrder.glass_specifications.frame_material}</span>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.frame_color && (
                        <div>
                          <span className="text-gray-600">Frame Color:</span>
                          <span className="ml-2 font-medium">{selectedOrder.glass_specifications.frame_color}</span>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.lens_coating && (
                        <div>
                          <span className="text-gray-600">Lens Coating:</span>
                          <span className="ml-2 font-medium">{selectedOrder.glass_specifications.lens_coating}</span>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.blue_light_filter && (
                        <div className="col-span-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Blue Light Filter Included
                          </Badge>
                        </div>
                      )}
                      {selectedOrder.glass_specifications.progressive_lens && (
                        <div className="col-span-2">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            Progressive Lens
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reserved Products */}
                {selectedOrder.reserved_products && selectedOrder.reserved_products.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Products</h3>
                    <div className="space-y-2">
                      {selectedOrder.reserved_products.map((product, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-gray-900">{product.description}</span>
                          <span className="text-gray-600">Qty: {product.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Dates */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Order Date:</span>
                      <p className="font-medium">{formatDate(selectedOrder.created_at)}</p>
                    </div>
                    {selectedOrder.appointment && (
                      <div>
                        <span className="text-gray-600">Appointment Date:</span>
                        <p className="font-medium">{formatDate(selectedOrder.appointment.date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerGlassOrders;

