import React, { useMemo, useState, useEffect } from 'react';
import { createReceipt, ReceiptItemInput } from '@/features/receipts/services/receipts.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Props {
  appointmentId: number;
  defaultCustomerName: string;
  defaultAddress?: string;
  customerId?: number;
}

interface Reservation {
  id: number;
  quantity: number;
  status: string;
  user_id?: number;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  product: {
    id: number;
    name: string;
    description?: string;
    price: number;
    brand?: string;
    model?: string;
  };
}

export const StaffCreateReceipt: React.FC<Props> = ({ appointmentId, defaultCustomerName, defaultAddress, customerId }) => {
  const { toast } = useToast();
  const [salesType, setSalesType] = useState<'cash' | 'charge'>('cash');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [customerName, setCustomerName] = useState<string>(defaultCustomerName);
  const [tin, setTin] = useState<string>('');
  const [address, setAddress] = useState<string>(defaultAddress || '');
  const [items, setItems] = useState<ReceiptItemInput[]>([{ description: '', qty: 1, unit_price: 0, amount: 0 }]);
  const [discount, setDiscount] = useState<number>(0);
  const [withholdingTax, setWithholdingTax] = useState<number>(0);
  const [loadingReservations, setLoadingReservations] = useState(false);

  // Fetch and populate reserved products, selected products from gallery, and today's services
  useEffect(() => {
    const loadAllReceiptData = async () => {
      if (!customerId) {
        console.warn('No customer ID provided, skipping data load');
        return;
      }
      
      try {
        setLoadingReservations(true);
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
        const token = sessionStorage.getItem('auth_token');
        const receiptItems: ReceiptItemInput[] = [];

        // 1. Load selected products from gallery (stored in sessionStorage)
        const selectedProductsKey = `selected_products_${customerId}`;
        const selectedProductsData = sessionStorage.getItem(selectedProductsKey);
        if (selectedProductsData) {
          try {
            const selectedProducts = JSON.parse(selectedProductsData);
            console.log(`Found ${selectedProducts.length} selected product(s) from gallery for customer ${customerId}`);
            
            selectedProducts.forEach((product: any) => {
              let description = product.name || 'Selected Product';
              if (product.brand) description += ` - ${product.brand}`;
              if (product.model) description += ` (${product.model})`;
              if (product.description) description += ` - ${product.description}`;
              
              receiptItems.push({
                description,
                qty: product.quantity || 1,
                unit_price: Number(product.price || 0),
                amount: Number(product.price || 0) * (product.quantity || 1)
              });
            });
            
            // Clear selected products after loading
            sessionStorage.removeItem(selectedProductsKey);
          } catch (error) {
            console.error('Error parsing selected products:', error);
          }
        }

        // 2. Load reservations (approved/completed)
        const response = await fetch(`${apiBaseUrl}/reservations`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const allReservations: Reservation[] = await response.json();
          const customerReservations = allReservations.filter(reservation => {
            const reservationUserId = reservation.user?.id || reservation.user_id;
            const isCorrectCustomer = reservationUserId === customerId;
            const isApprovedOrCompleted = reservation.status === 'approved' || reservation.status === 'completed';
            return isCorrectCustomer && isApprovedOrCompleted;
          });

          console.log(`Found ${customerReservations.length} approved/completed reservation(s) for customer ${customerId}`);

          customerReservations.forEach(reservation => {
            const product = reservation.product;
            let description = product.name || 'Reserved Product';
            if (product.brand) description += ` - ${product.brand}`;
            if (product.model) description += ` (${product.model})`;
            if (product.description) description += ` - ${product.description}`;
            
            receiptItems.push({
              description,
              qty: reservation.quantity,
              unit_price: Number(product.price),
              amount: Number(product.price) * reservation.quantity
            });
          });
        }

        // 3. Load today's appointments/services for this customer
        const today = new Date().toISOString().split('T')[0];
        const appointmentsResponse = await fetch(`${apiBaseUrl}/appointments?patient_id=${customerId}&date=${today}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (appointmentsResponse.ok) {
          const appointments = await appointmentsResponse.json();
          const todayAppointments = Array.isArray(appointments) 
            ? appointments.filter((apt: any) => apt.appointment_date === today || apt.appointment_date?.startsWith(today))
            : (appointments.data || []).filter((apt: any) => apt.appointment_date === today || apt.appointment_date?.startsWith(today));

          console.log(`Found ${todayAppointments.length} appointment(s) today for customer ${customerId}`);

          // Add services based on appointment type
          todayAppointments.forEach((appointment: any) => {
            if (appointment.status === 'completed' || appointment.status === 'confirmed') {
              let serviceDescription = '';
              let servicePrice = 500; // Default eye exam price

              switch (appointment.type) {
                case 'eye_exam':
                  serviceDescription = 'Eye Examination';
                  servicePrice = 500;
                  break;
                case 'contact_fitting':
                  serviceDescription = 'Contact Lens Fitting';
                  servicePrice = 800;
                  break;
                case 'follow_up':
                  serviceDescription = 'Follow-up Consultation';
                  servicePrice = 300;
                  break;
                case 'consultation':
                  serviceDescription = 'Consultation';
                  servicePrice = 400;
                  break;
                case 'emergency':
                  serviceDescription = 'Emergency Consultation';
                  servicePrice = 1000;
                  break;
                default:
                  serviceDescription = 'Eye Examination';
                  servicePrice = 500;
              }

              // Check if this service is already in the items (avoid duplicates)
              const serviceExists = receiptItems.some(item => 
                item.description.toLowerCase().includes(serviceDescription.toLowerCase())
              );

              if (!serviceExists) {
                receiptItems.push({
                  description: serviceDescription,
                  qty: 1,
                  unit_price: servicePrice,
                  amount: servicePrice
                });
              }
            }
          });
        }

        // Set all items (services first, then products)
        if (receiptItems.length > 0) {
          // Sort: services first, then products
          const services = receiptItems.filter(item => 
            item.description.includes('Examination') || 
            item.description.includes('Consultation') || 
            item.description.includes('Fitting')
          );
          const products = receiptItems.filter(item => !services.includes(item));
          
          setItems([...services, ...products]);
          
          toast({
            title: 'Receipt Data Loaded',
            description: `Loaded ${services.length} service(s) and ${products.length} product(s) for ${defaultCustomerName}`,
          });
        } else {
          // Default: just add eye examination if nothing found
          setItems([{
            description: 'Eye Examination',
            qty: 1,
            unit_price: 500,
            amount: 500
          }]);
          
          toast({
            title: 'No Data Found',
            description: `No products or services found for ${defaultCustomerName} today.`,
            variant: 'default',
          });
        }
      } catch (error) {
        console.error('Error loading receipt data:', error);
        toast({
          title: 'Note',
          description: 'Could not load all data. You can add items manually.',
          variant: 'default',
        });
        // Default: just add eye examination on error
        setItems([{
          description: 'Eye Examination',
          qty: 1,
          unit_price: 500,
          amount: 500
        }]);
      } finally {
        setLoadingReservations(false);
      }
    };

    loadAllReceiptData();
  }, [customerId, appointmentId, defaultCustomerName, toast]);

  const computed = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    const vatRate = 0.12;
    const vatableSales = subtotal / (1 + vatRate);
    const vatAmount = subtotal - vatableSales;
    const netOfVat = vatableSales;
    const totalDue = subtotal - discount - withholdingTax;
    return { subtotal, vatableSales, vatAmount, netOfVat, totalDue };
  }, [items, discount, withholdingTax]);

  const setItem = (idx: number, patch: Partial<ReceiptItemInput>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch, amount: Number(patch.unit_price ?? it.unit_price) * Number(patch.qty ?? it.qty) } : it));
  };

  const addRow = () => setItems(prev => [...prev, { description: '', qty: 1, unit_price: 0, amount: 0 }]);
  const removeRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    try {
      const payload = {
        appointment_id: appointmentId,
        sales_type: salesType,
        date,
        customer_name: customerName,
        tin: tin || undefined,
        address: address || undefined,
        items,
        totals: {
          vatable_sales: Number(computed.vatableSales.toFixed(2)),
          vat_amount: Number(computed.vatAmount.toFixed(2)),
          zero_rated_sales: 0,
          vat_exempt_sales: 0,
          net_of_vat: Number(computed.netOfVat.toFixed(2)),
          less_vat: Number(computed.vatAmount.toFixed(2)),
          add_vat: Number(computed.vatAmount.toFixed(2)),
          discount: Number(discount),
          withholding_tax: Number(withholdingTax),
          total_due: Number(computed.totalDue.toFixed(2)),
        },
      } as const;
      await createReceipt(payload as any);
      toast({ title: 'Receipt saved', description: 'Customers can now download the PDF.' });
    } catch (e: any) {
      toast({ title: 'Failed to save receipt', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Service Invoice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Sales Type</Label>
            <Select value={salesType} onValueChange={(v: any) => setSalesType(v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="charge">Charge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Registered Name</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div>
            <Label>TIN</Label>
            <Input value={tin} onChange={e => setTin(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="grid grid-cols-12 gap-2 font-medium">
            <div className="col-span-6">Item Description / Nature of Service</div>
            <div className="col-span-2">QTY</div>
            <div className="col-span-2">Unit Price</div>
            <div className="col-span-2">Amount</div>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center mt-2">
              <div className="col-span-6"><Input value={it.description} onChange={e => setItem(idx, { description: e.target.value })} /></div>
              <div className="col-span-2"><Input type="number" value={it.qty} onChange={e => setItem(idx, { qty: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Input type="number" value={it.unit_price} onChange={e => setItem(idx, { unit_price: Number(e.target.value) })} /></div>
              <div className="col-span-2 flex gap-2">
                <Input type="number" value={it.amount} onChange={e => setItem(idx, { amount: Number(e.target.value) })} />
                <Button variant="ghost" onClick={() => removeRow(idx)}>Remove</Button>
              </div>
            </div>
          ))}
          <div className="mt-2"><Button variant="secondary" onClick={addRow}>Add Item</Button></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between"><span>Vatable Sales</span><span>₱{computed.vatableSales.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>VAT</span><span>₱{computed.vatAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Zero Rated Sales</span><span>₱0.00</span></div>
            <div className="flex justify-between"><span>VAT-Exempt Sales</span><span>₱0.00</span></div>
          </div>
          <div>
            <div className="flex justify-between"><span>Less: Discount</span><Input className="w-28" type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
            <div className="flex justify-between"><span>Add: VAT</span><span>₱{computed.vatAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Less: Withholding Tax</span><Input className="w-28" type="number" value={withholdingTax} onChange={e => setWithholdingTax(Number(e.target.value))} /></div>
            <div className="flex justify-between font-semibold text-lg"><span>Total Amount Due</span><span>₱{computed.totalDue.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSubmit}>Save Receipt</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StaffCreateReceipt;
