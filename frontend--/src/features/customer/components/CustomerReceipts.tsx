import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Eye, Calendar, CreditCard, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getCustomerReceipts, downloadReceipt, Receipt } from '@/services/receiptApi';

const CustomerReceipts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReceipt, setSelectedReceipt] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipts();
  }, [user?.id]);

  const fetchReceipts = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getCustomerReceipts(user.id);
      console.log('Receipts data:', response.data);
      setReceipts(response.data);
    } catch (error: any) {
      console.error('Error fetching receipts:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch receipts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'refunded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'credit card': return <CreditCard className="w-4 h-4" />;
      case 'debit card': return <CreditCard className="w-4 h-4" />;
      case 'insurance': return <Eye className="w-4 h-4" />;
      case 'online': return <CreditCard className="w-4 h-4" />;
      default: return <span className="text-sm font-bold">₱</span>;
    }
  };

  const formatCurrency = (amount: any): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    return isNaN(numAmount) ? '0.00' : numAmount.toFixed(2);
  };

  const handleDownloadReceipt = async (receiptId: number) => {
    try {
      // Get the auth token
      const token = sessionStorage.getItem('auth_token');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to download receipts",
          variant: "destructive",
        });
        return;
      }

      // Make the download request
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiBaseUrl}/receipts/${receiptId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf, application/json',
        },
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        // Provide user-friendly error messages
        if (response.status === 401) {
          errorMessage = "Authentication required. Please log in again.";
        } else if (response.status === 403) {
          errorMessage = "You don't have permission to download this receipt.";
        } else if (response.status === 404) {
          errorMessage = "Receipt not found.";
        } else if (response.status === 500) {
          errorMessage = "Server error. Please try again later or contact support.";
        }
        
        throw new Error(errorMessage);
      }

      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // If it's JSON, it's an error response
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to download receipt');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Verify it's a PDF
      if (blob.type && !blob.type.includes('pdf') && blob.size > 0) {
        // Try to read as text to see if it's an error message
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Failed to download receipt');
        } catch (e) {
          // Not JSON, might be HTML error page
          throw new Error('Received invalid file format. Please try again.');
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receiptId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Receipt download has been initiated",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading receipts...</span>
        </div>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Please log in to view your receipts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Receipts</h1>
        <p className="text-gray-600 mt-2">View and download your payment receipts</p>
      </div>

      {receipts.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Receipts Found</h3>
              <p className="text-muted-foreground">
                You don't have any receipts yet. Receipts will appear here after you complete appointments or purchases.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {receipts.map(receipt => (
              <Card key={receipt.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">#{receipt.receipt_number}</span>
                      </div>
                      <Badge className={getStatusColor(receipt.payment_status)}>
                        {receipt.payment_status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedReceipt(selectedReceipt === receipt.id ? null : receipt.id)}
                    >
                      {selectedReceipt === receipt.id ? 'Hide' : 'View'} Details
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {format(new Date(receipt.created_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    
                    {receipt.branch && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{receipt.branch.name}</span>
                      </div>
                    )}
                    
                    {receipt.appointment?.optometrist && (
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{receipt.appointment.optometrist.name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {getPaymentIcon(receipt.payment_method)}
                      <span className="text-sm text-gray-600 capitalize">{receipt.payment_method}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Amount</span>
                      <span className="text-lg font-semibold">₱{formatCurrency(receipt.total_amount)}</span>
                    </div>
                  </div>

                  {selectedReceipt === receipt.id && (
                    <div className="mt-4 space-y-3 pt-3 border-t">
                      <h4 className="font-medium text-sm mb-2">Items:</h4>
                      <div className="space-y-2">
                        {receipt.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.description} (x{item.quantity})</span>
                            <span>₱{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t pt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>₱{formatCurrency(receipt.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Tax</span>
                          <span>₱{formatCurrency(receipt.tax_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                          <span>Total</span>
                          <span>₱{formatCurrency(receipt.total_amount)}</span>
                        </div>
                      </div>
                      
                      {receipt.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <h5 className="font-medium text-sm mb-1">Notes:</h5>
                          <p className="text-sm text-gray-600">{receipt.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDownloadReceipt(receipt.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedReceipt(selectedReceipt === receipt.id ? null : receipt.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {selectedReceipt === receipt.id ? 'Hide' : 'View'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReceipts;