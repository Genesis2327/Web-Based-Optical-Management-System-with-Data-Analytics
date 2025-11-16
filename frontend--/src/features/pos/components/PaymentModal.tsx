/**
 * PaymentModal Component
 * 
 * ⚠️ LIMITATION: This component uses mock/simulated payment processing.
 * Online payment options (GCash, PayMaya, Credit/Debit Card) are for demonstration
 * purposes only and do not integrate with actual payment gateway providers.
 * Transactions are recorded in the database but do not process real financial transactions.
 */
import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Banknote, CheckCircle, X, AlertCircle, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { paymentService, PaymentRequest, PaymentResponse, PaymentMethodConfig } from '../../../services/paymentService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (response: PaymentResponse) => void;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  customerInfo: {
    name: string;
    email?: string;
    phone?: string;
  };
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  totalAmount,
  items,
  customerInfo
}) => {
  const [selectedMethod, setSelectedMethod] = useState<string>('cash');
  const [processing, setProcessing] = useState(false);
  const [paymentResponse, setPaymentResponse] = useState<PaymentResponse | null>(null);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const availableMethods = paymentService.getAvailablePaymentMethods();
  const processingFee = paymentService.calculateProcessingFee(totalAmount, selectedMethod);
  const finalAmount = totalAmount + processingFee;

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast.error('Please select a payment method');
      return;
    }

    if (selectedMethod === 'card' && !validateCardDetails()) {
      return;
    }

    setProcessing(true);
    setPaymentResponse(null);

    try {
      const paymentRequest: PaymentRequest = {
        amount: totalAmount,
        currency: 'PHP',
        paymentMethod: selectedMethod as any,
        customerInfo,
        description: `Payment for ${items.length} items`,
        items
      };

      const response = await paymentService.processPayment(paymentRequest);
      setPaymentResponse(response);

      if (response.success) {
        if (response.status === 'completed') {
          toast.success('Payment completed successfully!');
          onPaymentSuccess(response);
        } else if (response.status === 'pending') {
          toast.info('Payment initiated. Please complete the payment.');
          startPolling(response.transactionId!);
        }
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error('Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const validateCardDetails = (): boolean => {
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv || !cardDetails.name) {
      toast.error('Please fill in all card details');
      return false;
    }

    // Basic validation
    if (cardDetails.number.replace(/\s/g, '').length < 16) {
      toast.error('Please enter a valid card number');
      return false;
    }

    if (cardDetails.cvv.length < 3) {
      toast.error('Please enter a valid CVV');
      return false;
    }

    return true;
  };

  const startPolling = (transactionId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await paymentService.checkPaymentStatus(transactionId);
        if (status.status === 'completed') {
          toast.success('Payment completed successfully!');
          onPaymentSuccess(status);
          clearInterval(interval);
          setPollingInterval(null);
        } else if (status.status === 'failed') {
          toast.error('Payment failed');
          clearInterval(interval);
          setPollingInterval(null);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const getMethodIcon = (methodId: string) => {
    switch (methodId) {
      case 'cash':
        return <Banknote className="h-5 w-5" />;
      case 'card':
        return <CreditCard className="h-5 w-5" />;
      case 'gcash':
      case 'paymaya':
        return <Smartphone className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const renderCardForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="card-number">Card Number</Label>
          <Input
            id="card-number"
            placeholder="1234 5678 9012 3456"
            value={cardDetails.number}
            onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
            maxLength={19}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="card-name">Cardholder Name</Label>
          <Input
            id="card-name"
            placeholder="John Doe"
            value={cardDetails.name}
            onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="card-expiry">Expiry Date</Label>
          <Input
            id="card-expiry"
            placeholder="MM/YY"
            value={cardDetails.expiry}
            onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
            maxLength={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="card-cvv">CVV</Label>
          <Input
            id="card-cvv"
            placeholder="123"
            value={cardDetails.cvv}
            onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
            maxLength={4}
            type="password"
          />
        </div>
      </div>
    </div>
  );

  const renderQRCode = () => (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <QrCode className="h-32 w-32 text-gray-400" />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Scan this QR code with your {selectedMethod === 'gcash' ? 'GCash' : 'PayMaya'} app
        </p>
        <p className="text-lg font-semibold">Amount: ₱{finalAmount.toFixed(2)}</p>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">
          ⏱️ Payment will be automatically confirmed once completed
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Processing</DialogTitle>
          <DialogDescription>
            Complete your payment for the selected items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>₱{totalAmount.toFixed(2)}</span>
              </div>
              {processingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Processing Fee</span>
                  <span>₱{processingFee.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>₱{finalAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Select Payment Method</Label>
            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
              <div className="grid grid-cols-2 gap-4">
                {availableMethods.map((method) => (
                  <div key={method.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label htmlFor={method.id} className="flex items-center space-x-2 cursor-pointer flex-1">
                      {getMethodIcon(method.id)}
                      <div>
                        <div className="font-medium">{method.name}</div>
                        {method.processingFee > 0 && (
                          <div className="text-xs text-gray-500">
                            {(method.processingFee * 100).toFixed(1)}% fee
                          </div>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Payment Form */}
          {selectedMethod === 'card' && renderCardForm()}
          {selectedMethod === 'gcash' && renderQRCode()}
          {selectedMethod === 'paymaya' && renderQRCode()}

          {/* Payment Status */}
          {paymentResponse && (
            <Card className={paymentResponse.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  {paymentResponse.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className={`font-medium ${paymentResponse.success ? 'text-green-800' : 'text-red-800'}`}>
                      {paymentResponse.message}
                    </p>
                    {paymentResponse.transactionId && (
                      <p className="text-sm text-gray-600">
                        Transaction ID: {paymentResponse.transactionId}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
            <Button 
              onClick={handlePayment} 
              disabled={processing || (selectedMethod === 'card' && !validateCardDetails())}
              className="min-w-32"
            >
              {processing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                `Pay ₱${finalAmount.toFixed(2)}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
