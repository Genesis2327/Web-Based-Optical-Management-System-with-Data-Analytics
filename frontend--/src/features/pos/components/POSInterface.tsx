/**
 * POS Interface Component
 * 
 * ⚠️ LIMITATION: Online payment options (GCash, PayMaya, Credit/Debit Card) use
 * mock/simulated processing for demonstration purposes only. These do not integrate
 * with actual payment gateway providers. Cash payments are functional, but online
 * payment transactions are recorded in the database without processing real financial transactions.
 */
import React, { useState, useEffect } from 'react';
import { ShoppingCart, CreditCard, Receipt, Search, Plus, Minus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../products/types/product.types';
import { getProducts } from '../../../services/productApi';

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const POSInterface: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  const paymentMethods: PaymentMethod[] = [
    { id: 'cash', name: 'Cash', icon: <Calculator className="w-5 h-5" /> },
    { id: 'card', name: 'Credit/Debit Card', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'gcash', name: 'GCash', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'paymaya', name: 'PayMaya', icon: <CreditCard className="w-5 h-5" /> }
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        price: Number(product.price)
      }]);
    }
    toast.success(`${product.name} added to cart`);
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTax = () => {
    return getSubtotal() * 0.12; // 12% VAT
  };

  const getTotal = () => {
    return getSubtotal() + getTax();
  };

  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!customerInfo.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    try {
      setLoading(true);
      
      // Create transaction record
      const transaction = {
        customer: customerInfo,
        items: cart,
        payment_method: selectedPaymentMethod,
        subtotal: getSubtotal(),
        tax: getTax(),
        total: getTotal(),
        timestamp: new Date().toISOString()
      };

      // Here you would typically send to your backend API
      console.log('Processing transaction:', transaction);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Payment processed successfully!');
      
      // Generate receipt
      generateReceipt(transaction);
      
      // Clear cart and form
      setCart([]);
      setCustomerInfo({ name: '', phone: '', email: '' });
      
    } catch (error) {
      toast.error('Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = (transaction: any) => {
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head>
            <title>Receipt - Everbright Optical</title>
            <style>
              body { font-family: monospace; margin: 20px; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .total { border-top: 1px solid #000; padding-top: 10px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>EVERBRIGHT OPTICAL</h2>
              <p>Receipt #${Date.now()}</p>
              <p>${new Date().toLocaleString()}</p>
            </div>
            
            <div>
              <p><strong>Customer:</strong> ${transaction.customer.name}</p>
              ${transaction.customer.phone ? `<p><strong>Phone:</strong> ${transaction.customer.phone}</p>` : ''}
              ${transaction.customer.email ? `<p><strong>Email:</strong> ${transaction.customer.email}</p>` : ''}
            </div>
            
            <div style="margin: 20px 0;">
              ${transaction.items.map((item: any) => `
                <div class="item">
                  <span>${item.product.name} x${item.quantity}</span>
                  <span>₱${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
            
            <div class="total">
              <div class="item">
                <span>Subtotal:</span>
                <span>₱${transaction.subtotal.toFixed(2)}</span>
              </div>
              <div class="item">
                <span>VAT (12%):</span>
                <span>₱${transaction.tax.toFixed(2)}</span>
              </div>
              <div class="item">
                <span><strong>Total:</strong></span>
                <span><strong>₱${transaction.total.toFixed(2)}</strong></span>
              </div>
              <div class="item">
                <span>Payment Method:</span>
                <span>${transaction.payment_method.toUpperCase()}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>Thank you for your business!</p>
              <p>Everbright Optical Clinic</p>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      receiptWindow.print();
    }
  };

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Product Selection Panel */}
      <div className="w-2/3 p-4">
        <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold mb-4">Product Selection</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => addToCart(product)}
                  >
                    <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
                      {product.image_paths && product.image_paths.length > 0 ? (
                        <img
                          src={`http://127.0.0.1:8000/storage/${product.image_paths[0]}`}
                          alt={product.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-blue-600 font-bold">₱{Number(product.price).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart and Checkout Panel */}
      <div className="w-1/3 p-4">
        <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Cart ({cart.length})
            </h2>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.product.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{item.product.name}</h4>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold">₱{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="p-4 border-t">
            <h3 className="font-medium mb-3">Customer Information</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Customer Name *"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-4 border-t">
            <h3 className="font-medium mb-3">Payment Method</h3>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(method => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  className={`p-2 border rounded-md flex items-center justify-center space-x-2 ${
                    selectedPaymentMethod === method.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {method.icon}
                  <span className="text-sm">{method.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Totals and Checkout */}
          <div className="p-4 border-t bg-gray-50">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₱{getSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT (12%):</span>
                <span>₱{getTax().toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>₱{getTotal().toFixed(2)}</span>
              </div>
            </div>
            
            <button
              onClick={processPayment}
              disabled={loading || cart.length === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  <span>Process Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSInterface;

