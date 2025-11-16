// Payment processing service for Everbright Optical Clinic
// 
// ⚠️ IMPORTANT LIMITATION: MOCK/SIMULATION IMPLEMENTATION ONLY
// 
// This service provides a user interface for processing payments through GCash, PayMaya, 
// and Credit/Debit Card methods. However, this is a SIMULATED/MOCK implementation for 
// demonstration purposes only. The system does NOT integrate with actual payment gateway 
// providers (e.g., Stripe, PayPal, GCash API, PayMaya API).
// 
// All payment processing methods in this service use mock logic that simulates API 
// responses but does not process real financial transactions through external payment 
// processors. Transactions marked as online payments are recorded in the database but 
// do not involve actual payment processing.
// 
// For production use, third-party payment gateway integration would be required.

export interface PaymentRequest {
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'card' | 'gcash' | 'paymaya';
  customerInfo: {
    name: string;
    email?: string;
    phone?: string;
  };
  description: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentMethod: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  message: string;
  receiptUrl?: string;
  qrCode?: string; // For GCash/PayMaya
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  processingFee: number;
  minAmount: number;
  maxAmount: number;
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'cash',
    name: 'Cash Payment',
    icon: '💵',
    enabled: true,
    processingFee: 0,
    minAmount: 0,
    maxAmount: 100000
  },
  {
    id: 'card',
    name: 'Credit/Debit Card',
    icon: '💳',
    enabled: true,
    processingFee: 0.035, // 3.5%
    minAmount: 100,
    maxAmount: 100000
  },
  {
    id: 'gcash',
    name: 'GCash',
    icon: '📱',
    enabled: true,
    processingFee: 0.02, // 2%
    minAmount: 50,
    maxAmount: 50000
  },
  {
    id: 'paymaya',
    name: 'PayMaya',
    icon: '📱',
    enabled: true,
    processingFee: 0.02, // 2%
    minAmount: 50,
    maxAmount: 50000
  }
];

import { API_BASE_URL } from '../config/api';

class PaymentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Process a payment request
   */
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Calculate total amount including processing fees
      const method = PAYMENT_METHODS.find(m => m.id === paymentRequest.paymentMethod);
      if (!method) {
        throw new Error('Invalid payment method');
      }

      const processingFee = paymentRequest.amount * method.processingFee;
      const totalAmount = paymentRequest.amount + processingFee;

      // Validate amount limits
      if (totalAmount < method.minAmount) {
        throw new Error(`Minimum amount for ${method.name} is ₱${method.minAmount}`);
      }
      if (totalAmount > method.maxAmount) {
        throw new Error(`Maximum amount for ${method.name} is ₱${method.maxAmount}`);
      }

      // Simulate payment processing based on method
      switch (paymentRequest.paymentMethod) {
        case 'cash':
          return this.processCashPayment(paymentRequest, totalAmount);
        case 'card':
          return this.processCardPayment(paymentRequest, totalAmount);
        case 'gcash':
          return this.processGCashPayment(paymentRequest, totalAmount);
        case 'paymaya':
          return this.processPayMayaPayment(paymentRequest, totalAmount);
        default:
          throw new Error('Unsupported payment method');
      }
    } catch (error) {
      return {
        success: false,
        paymentMethod: paymentRequest.paymentMethod,
        amount: paymentRequest.amount,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  /**
   * Process cash payment (immediate completion)
   */
  private async processCashPayment(request: PaymentRequest, totalAmount: number): Promise<PaymentResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      transactionId: `CASH_${Date.now()}`,
      paymentMethod: 'cash',
      amount: totalAmount,
      status: 'completed',
      message: 'Cash payment received successfully'
    };
  }

  /**
   * Process card payment
   */
  private async processCardPayment(request: PaymentRequest, totalAmount: number): Promise<PaymentResponse> {
    // Simulate card processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate random success/failure for demo
    const success = Math.random() > 0.1; // 90% success rate

    if (success) {
      return {
        success: true,
        transactionId: `CARD_${Date.now()}`,
        paymentMethod: 'card',
        amount: totalAmount,
        status: 'completed',
        message: 'Card payment processed successfully'
      };
    } else {
      return {
        success: false,
        paymentMethod: 'card',
        amount: totalAmount,
        status: 'failed',
        message: 'Card payment declined. Please try a different card.'
      };
    }
  }

  /**
   * Process GCash payment
   */
  private async processGCashPayment(request: PaymentRequest, totalAmount: number): Promise<PaymentResponse> {
    // Simulate GCash processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const transactionId = `GCASH_${Date.now()}`;
    const qrCode = this.generateQRCode(transactionId, totalAmount);

    return {
      success: true,
      transactionId,
      paymentMethod: 'gcash',
      amount: totalAmount,
      status: 'pending',
      message: 'Please scan the QR code with your GCash app to complete payment',
      qrCode
    };
  }

  /**
   * Process PayMaya payment
   */
  private async processPayMayaPayment(request: PaymentRequest, totalAmount: number): Promise<PaymentResponse> {
    // Simulate PayMaya processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const transactionId = `PAYMAYA_${Date.now()}`;
    const qrCode = this.generateQRCode(transactionId, totalAmount);

    return {
      success: true,
      transactionId,
      paymentMethod: 'paymaya',
      amount: totalAmount,
      status: 'pending',
      message: 'Please scan the QR code with your PayMaya app to complete payment',
      qrCode
    };
  }

  /**
   * Generate QR code for mobile payments
   */
  private generateQRCode(transactionId: string, amount: number): string {
    // In a real implementation, this would generate an actual QR code
    // For demo purposes, we'll return a placeholder
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="12">
          QR Code for ${transactionId}
        </text>
        <text x="100" y="120" text-anchor="middle" font-family="Arial" font-size="10">
          Amount: ₱${amount.toFixed(2)}
        </text>
      </svg>
    `)}`;
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      // Simulate API call to check payment status
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo, randomly return completed or pending
      const isCompleted = Math.random() > 0.3; // 70% chance of completion

      return {
        success: true,
        transactionId,
        paymentMethod: 'unknown',
        amount: 0,
        status: isCompleted ? 'completed' : 'pending',
        message: isCompleted ? 'Payment completed successfully' : 'Payment is still pending'
      };
    } catch (error) {
      return {
        success: false,
        paymentMethod: 'unknown',
        amount: 0,
        status: 'failed',
        message: 'Failed to check payment status'
      };
    }
  }

  /**
   * Get available payment methods
   */
  getAvailablePaymentMethods(): PaymentMethodConfig[] {
    return PAYMENT_METHODS.filter(method => method.enabled);
  }

  /**
   * Calculate processing fee for a payment method
   */
  calculateProcessingFee(amount: number, paymentMethod: string): number {
    const method = PAYMENT_METHODS.find(m => m.id === paymentMethod);
    if (!method) return 0;
    return amount * method.processingFee;
  }

  /**
   * Validate payment method for amount
   */
  validatePaymentMethod(amount: number, paymentMethod: string): { valid: boolean; message?: string } {
    const method = PAYMENT_METHODS.find(m => m.id === paymentMethod);
    if (!method) {
      return { valid: false, message: 'Invalid payment method' };
    }

    if (amount < method.minAmount) {
      return { valid: false, message: `Minimum amount for ${method.name} is ₱${method.minAmount}` };
    }

    if (amount > method.maxAmount) {
      return { valid: false, message: `Maximum amount for ${method.name} is ₱${method.maxAmount}` };
    }

    return { valid: true };
  }
}

export const paymentService = new PaymentService();

