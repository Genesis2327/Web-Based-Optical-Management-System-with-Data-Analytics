import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Transaction } from '../../services/transactionApi';
import { PackageIcon, EyeIcon, CalendarIcon } from 'lucide-react';

interface ReservedProductsGalleryProps {
  transactions: Transaction[];
}

export const ReservedProductsGallery: React.FC<ReservedProductsGalleryProps> = ({ transactions }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProductImage = (product: any) => {
    return product?.image_url || product?.image || '/placeholder-product.jpg';
  };

  // Filter transactions that have reservations
  const transactionsWithReservations = transactions.filter(t => t.reservation);

  if (transactionsWithReservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PackageIcon className="w-5 h-5" />
            <span>Reserved Products</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No products have been reserved yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="reserved-products-gallery-container">
      <style>{`
        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */
        
        @media (max-width: 319px) {
          .reserved-products-gallery-container {
            padding: 0.5rem;
          }
        }
        
        @media (min-width: 320px) and (max-width: 480px) {
          .reserved-products-gallery-container {
            padding: 0.75rem;
          }
          .reserved-products-gallery-container .grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (min-width: 481px) and (max-width: 767px) {
          .reserved-products-gallery-container {
            padding: 1rem;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1024px) {
          .reserved-products-gallery-container {
            padding: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) and (max-width: 1280px) {
          .reserved-products-gallery-container {
            padding: 2rem;
          }
        }
        
        @media (min-width: 1281px) {
          .reserved-products-gallery-container {
            padding: 2.5rem;
          }
        }
        
        @media (hover: none) and (pointer: coarse) {
          .reserved-products-gallery-container * {
            min-height: 44px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .reserved-products-gallery-container * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <PackageIcon className="w-5 h-5" />
          <span>Reserved Products from Gallery</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transactionsWithReservations.map((transaction) => (
            <div key={transaction.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              {/* Product Image */}
              <div className="aspect-square bg-gray-100 relative">
                <img 
                  src={getProductImage(transaction.reservation?.product)} 
                  alt={transaction.reservation?.product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-product.jpg';
                  }}
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="bg-white/90">
                    {transaction.reservation?.quantity}x
                  </Badge>
                </div>
              </div>

              {/* Product Details */}
              <div className="p-4">
                <h3 className="font-medium text-lg mb-2 line-clamp-2">
                  {transaction.reservation?.product.name}
                </h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Price:</span>
                    <span className="font-medium">
                      {formatCurrency(transaction.reservation?.product.price || 0)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Quantity:</span>
                    <span className="font-medium">{transaction.reservation?.quantity}</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-sm font-medium">Total:</span>
                    <span className="font-bold text-lg">
                      {formatCurrency((transaction.reservation?.product.price || 0) * (transaction.reservation?.quantity || 0))}
                    </span>
                  </div>
                </div>

                {/* Product Info */}
                <div className="space-y-1 mb-4">
                  {transaction.reservation?.product?.brand && (
                    <p className="text-xs text-muted-foreground">
                      Brand: {transaction.reservation.product.brand}
                    </p>
                  )}
                  {transaction.reservation?.product?.category && (
                    <p className="text-xs text-muted-foreground">
                      Category: {transaction.reservation.product.category.name}
                    </p>
                  )}
                </div>

                {/* Transaction Info */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Transaction: {transaction.transaction_code}</span>
                    <span>{formatDate(transaction.created_at)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {transaction.status}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {transaction.payment_method}
                    </Badge>
                  </div>
                </div>

                {/* Associated Appointment */}
                {transaction.appointment && (
                  <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="flex items-center space-x-2 text-xs text-blue-700">
                      <EyeIcon className="w-3 h-3" />
                      <span>Eye Examination included</span>
                    </div>
                    {transaction.appointment.optometrist && (
                      <p className="text-xs text-blue-600 mt-1">
                        {transaction.appointment.optometrist.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Total Products Reserved:</p>
              <p className="text-2xl font-bold">
                {transactionsWithReservations.reduce((sum, t) => sum + (t.reservation?.quantity || 0), 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Total Value:</p>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  transactionsWithReservations.reduce(
                    (sum, t) => sum + ((t.reservation?.product.price || 0) * (t.reservation?.quantity || 0)), 
                    0
                  )
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

export default ReservedProductsGallery;
