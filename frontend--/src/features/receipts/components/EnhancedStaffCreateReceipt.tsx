import React, { useMemo, useState, useEffect } from 'react';
import { createReceipt, ReceiptItemInput } from '@/features/receipts/services/receipts.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, User, Calendar, FileText, Package, Phone, Mail, MapPin, ShoppingCart, Loader2 } from 'lucide-react';

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

interface Prescription {
  id: number;
  right_eye: any;
  left_eye: any;
  lens_type?: string;
  coating?: string;
  recommendations?: string;
  additional_notes?: string;
  created_at: string;
}

interface PatientDetails {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
}

export const EnhancedStaffCreateReceipt: React.FC<Props> = ({ 
  appointmentId, 
  defaultCustomerName, 
  defaultAddress, 
  customerId 
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.role === 'staff';
  const [salesType, setSalesType] = useState<'cash' | 'charge'>('cash');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [customerName, setCustomerName] = useState<string>(defaultCustomerName);
  const [tin, setTin] = useState<string>('');
  const [address, setAddress] = useState<string>(defaultAddress || '');
  const [items, setItems] = useState<ReceiptItemInput[]>([{ description: '', qty: 1, unit_price: 0, amount: 0 }]);
  const [discount, setDiscount] = useState<number>(0);
  const [withholdingTax, setWithholdingTax] = useState<number>(0);
  const [loadingReservations, setLoadingReservations] = useState(false);
  
  // Enhanced fields for comprehensive patient management
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [glassOrderDetails, setGlassOrderDetails] = useState({
    frameType: '',
    lensType: '',
    lensCoating: '',
    blueLightFilter: false,
    progressiveLens: false,
    bifocalLens: false,
    singleVision: false,
    lensMaterial: '',
    frameMaterial: '',
    frameColor: '',
    lensColor: '',
    specialInstructions: '',
    manufacturerNotes: ''
  });

  // Lens type options
  const lensTypes = [
    'Single Vision',
    'Progressive (Multifocal)',
    'Bifocal',
    'Trifocal',
    'Reading Glasses',
    'Computer Glasses',
    'Sunglasses',
    'Safety Glasses'
  ];

  const lensCoatings = [
    'Anti-Reflective',
    'Blue Light Filter',
    'UV Protection',
    'Scratch Resistant',
    'Anti-Fog',
    'Photochromic',
    'Polarized'
  ];

  const lensMaterials = [
    'CR-39 Plastic',
    'Polycarbonate',
    'Trivex',
    'High Index 1.60',
    'High Index 1.67',
    'High Index 1.74',
    'Glass'
  ];

  const frameMaterials = [
    'Acetate',
    'Metal',
    'Titanium',
    'Stainless Steel',
    'Carbon Fiber',
    'Wood',
    'Horn',
    'Plastic'
  ];

  // Fetch patient details and prescription
  useEffect(() => {
    const loadPatientData = async () => {
      if (!customerId) return;
      
      try {
        // Get API base URL - normalize to always end with /api
        const getNormalizedApiUrl = () => {
          const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          // Remove trailing /api if present, then add it back to ensure consistency
          return envUrl.replace(/\/api\/?$/, '') + '/api';
        };
        const apiBaseUrl = getNormalizedApiUrl();
        const token = sessionStorage.getItem('auth_token');

        // Fetch patient details
        const patientResponse = await fetch(`${apiBaseUrl}/patients/${customerId}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (patientResponse.ok) {
          const patientData = await patientResponse.json();
          // Handle different response formats - PatientController returns { patient: {...} }
          const patient = patientData?.patient || patientData;
          setPatientDetails(patient);
        }

        // Fetch latest prescription for this patient
        const prescriptionResponse = await fetch(`${apiBaseUrl}/prescriptions/patient/${customerId}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (prescriptionResponse.ok) {
          const prescriptions = await prescriptionResponse.json();
          if (prescriptions.length > 0) {
            const latestPrescription = prescriptions[0];
            setPrescription(latestPrescription);
            
            // Auto-populate lens details from prescription
            if (latestPrescription.lens_type) {
              setGlassOrderDetails(prev => ({
                ...prev,
                lensType: latestPrescription.lens_type,
                lensCoating: latestPrescription.coating || '',
                recommendations: latestPrescription.recommendations || ''
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading patient data:', error);
      }
    };

    loadPatientData();
  }, [customerId]);

  // Fetch and populate reserved products when component loads
  useEffect(() => {
    const loadReservedProducts = async () => {
      if (!customerId) {
        console.warn('No customer ID provided, skipping reservation load');
        return;
      }
      
      try {
        setLoadingReservations(true);
        // Get API base URL - normalize to always end with /api
        const getNormalizedApiUrl = () => {
          const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          return envUrl.replace(/\/api\/?$/, '') + '/api';
        };
        const apiBaseUrl = getNormalizedApiUrl();
        const token = sessionStorage.getItem('auth_token');

        console.log(`Loading reservations for customer ID: ${customerId}, Appointment ID: ${appointmentId}`);

        // Fetch all reservations for this branch (staff only see their branch)
        const response = await fetch(`${apiBaseUrl}/reservations?status=approved`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch reservations');
        }

        const allReservations: Reservation[] = await response.json();
        
        // Filter to only get reservations for THIS specific customer
        const customerReservations = allReservations.filter(reservation => {
          const reservationUserId = reservation.user?.id || reservation.user_id;
          return reservationUserId === customerId;
        });

        console.log(`Found ${customerReservations.length} approved reservation(s) for customer ${defaultCustomerName} (ID: ${customerId})`);

        // Convert reservations to receipt items
        if (customerReservations && customerReservations.length > 0) {
          const reservedItems: ReceiptItemInput[] = customerReservations.map(reservation => {
            const product = reservation.product;
            let description = product.name || 'Reserved Product';
            
            // Add additional details to description
            if (product.brand) description += ` - ${product.brand}`;
            if (product.model) description += ` (${product.model})`;
            if (product.description) description += ` - ${product.description}`;
            
            console.log(`Adding reserved product: ${description} (Qty: ${reservation.quantity}, Price: ${product.price})`);
            
            return {
              description,
              qty: reservation.quantity,
              unit_price: Number(product.price),
              amount: Number(product.price) * reservation.quantity
            };
          });

          // Add eye examination as default first item
          const eyeExamItem: ReceiptItemInput = {
            description: 'Eye Examination',
            qty: 1,
            unit_price: 500,
            amount: 500
          };

          // Set items: eye exam + reserved products
          setItems([eyeExamItem, ...reservedItems]);

          toast({
            title: 'Reserved Products Loaded',
            description: `${reservedItems.length} reserved product(s) for ${defaultCustomerName} added to receipt`,
          });
        } else {
          console.log(`No approved reservations found for customer ${defaultCustomerName} (ID: ${customerId})`);
          // No reservations, just add eye exam
          setItems([{
            description: 'Eye Examination',
            qty: 1,
            unit_price: 500,
            amount: 500
          }]);
          
          toast({
            title: 'No Reserved Products',
            description: `${defaultCustomerName} has no approved product reservations.`,
            variant: 'default',
          });
        }
      } catch (error) {
        console.error('Error loading reserved products:', error);
        toast({
          title: 'Note',
          description: 'Could not load reserved products. You can add them manually.',
          variant: 'default',
        });
        // Still add eye exam on error
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

    loadReservedProducts();
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
      
      // First create the receipt
      const receiptResponse = await createReceipt(payload as any);
      
      // Extract receipt ID from response
      const receiptId = receiptResponse?.id || receiptResponse?.data?.id || receiptResponse?.receipt?.id;
      
      // Then create glass order with reserved products and prescription data (only for admin)
      // Staff should not create glass orders - they only create receipts
      if (!isStaff && customerId && items.length > 1) { // Only create glass order if there are reserved products
        // Get API base URL - normalize to always end with /api
        const getNormalizedApiUrl = () => {
          const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          return envUrl.replace(/\/api\/?$/, '') + '/api';
        };
        const apiBaseUrl = getNormalizedApiUrl();
        const token = sessionStorage.getItem('auth_token');
        
        // Get reserved products (exclude eye exam)
        const reservedProducts = items.filter(item => item.description !== 'Eye Examination');
        
        const glassOrderPayload = {
          appointment_id: appointmentId,
          patient_id: customerId,
          prescription_id: prescription?.id || null,
          receipt_id: receiptId || null,
          reserved_products: reservedProducts.map(item => ({
            description: item.description,
            quantity: item.qty,
            unit_price: item.unit_price,
            amount: item.amount
          })),
          prescription_data: prescription ? {
            right_eye: prescription.right_eye,
            left_eye: prescription.left_eye,
            lens_type: prescription.lens_type,
            coating: prescription.coating,
            recommendations: prescription.recommendations,
            additional_notes: prescription.additional_notes
          } : null,
          frame_type: glassOrderDetails.frameType,
          lens_type: glassOrderDetails.lensType,
          lens_coating: glassOrderDetails.lensCoating,
          blue_light_filter: glassOrderDetails.blueLightFilter,
          progressive_lens: glassOrderDetails.progressiveLens,
          bifocal_lens: glassOrderDetails.bifocalLens,
          lens_material: glassOrderDetails.lensMaterial,
          frame_material: glassOrderDetails.frameMaterial,
          frame_color: glassOrderDetails.frameColor,
          lens_color: glassOrderDetails.lensColor,
          special_instructions: glassOrderDetails.specialInstructions,
          manufacturer_notes: glassOrderDetails.manufacturerNotes,
          priority: 'normal'
        };
        
        const glassOrderResponse = await fetch(`${apiBaseUrl}/glass-orders`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(glassOrderPayload)
        });
        
        if (glassOrderResponse.ok) {
          const glassOrderData = await glassOrderResponse.json();
          toast({ 
            title: 'Receipt & Glass Order saved successfully', 
            description: `Receipt created and glass order ${glassOrderData.data.formatted_number} is ready for manufacturer contact. Complete patient record with reserved products and prescription details has been saved.` 
          });
          
          // Navigate back to Reservations & Transactions
          setTimeout(() => {
            navigate('/staff/reservations');
          }, 1500);
        } else {
          toast({ 
            title: 'Receipt saved, Glass Order failed', 
            description: 'Receipt was saved but glass order creation failed. You can create it manually from patient management.' 
          });
          
          // Navigate back to Reservations & Transactions even if glass order failed
          setTimeout(() => {
            navigate('/staff/reservations');
          }, 1500);
        }
      } else {
        toast({ 
          title: 'Receipt saved successfully', 
          description: 'Receipt has been saved. No glass order needed as no reserved products were found.' 
        });
        
        // Navigate back to Reservations & Transactions
        setTimeout(() => {
          navigate('/staff/reservations');
        }, 1500);
      }
    } catch (e: any) {
      toast({ title: 'Failed to save receipt', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-blue-600" />
            <span>Patient Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Patient Name</Label>
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
        </CardContent>
      </Card>

      {/* Customer's Chosen Products Card - Hidden for staff */}
      {!isStaff && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <span>Customer's Chosen Products</span>
          </CardTitle>
          <CardDescription>Products that the customer has reserved and will be included in this receipt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingReservations ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading customer's products...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {items.filter(item => item.description !== 'Eye Examination').map((item, index) => (
                <div key={index} className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-800 mb-2">{item.description}</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-blue-600 font-medium">Quantity:</span>
                          <span className="ml-2">{item.qty}</span>
                        </div>
                        <div>
                          <span className="text-blue-600 font-medium">Unit Price:</span>
                          <span className="ml-2">₱{item.unit_price.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-blue-600 font-medium">Total:</span>
                          <span className="ml-2 font-semibold">₱{item.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="bg-blue-100 px-3 py-1 rounded-full text-blue-800 text-sm font-medium">
                        Reserved Product
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {items.filter(item => item.description !== 'Eye Examination').length === 0 && (
                <div className="text-center text-gray-500 p-6 border-2 border-dashed rounded-lg">
                  <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-600 mb-2">No Reserved Products</h4>
                  <p className="text-sm">This customer has not reserved any products yet. Only the eye examination will be charged.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Prescription Information Card - Hidden for staff */}
      {!isStaff && prescription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-green-600" />
              <span>Vision Prescription Details</span>
            </CardTitle>
            <CardDescription>Critical vision data to guide lens manufacturing for optimal customer vision correction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prescription Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Prescription Issue Date</Label>
                <Input value={prescription.issue_date || 'N/A'} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Prescription Expiry Date</Label>
                <Input value={prescription.expiry_date || 'N/A'} readOnly className="bg-gray-50" />
              </div>
            </div>

            {/* Vision Measurements */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Vision Measurements</h4>
              
              {/* Right Eye (OD) */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <Label className="text-base font-semibold text-blue-800 mb-3 block">Right Eye (OD - Oculus Dexter)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {prescription.right_eye && typeof prescription.right_eye === 'object' ? (
                    Object.entries(prescription.right_eye).map(([key, value]) => (
                      <div key={key}>
                        <Label className="text-xs text-blue-600 font-medium">{key.replace(/_/g, ' ').toUpperCase()}</Label>
                        <Input value={String(value || 'N/A')} readOnly className="bg-white text-sm" />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4">
                      <Input value={String(prescription.right_eye || 'N/A')} readOnly className="bg-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Left Eye (OS) */}
              <div className="bg-green-50 p-4 rounded-lg">
                <Label className="text-base font-semibold text-green-800 mb-3 block">Left Eye (OS - Oculus Sinister)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {prescription.left_eye && typeof prescription.left_eye === 'object' ? (
                    Object.entries(prescription.left_eye).map(([key, value]) => (
                      <div key={key}>
                        <Label className="text-xs text-green-600 font-medium">{key.replace(/_/g, ' ').toUpperCase()}</Label>
                        <Input value={String(value || 'N/A')} readOnly className="bg-white text-sm" />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4">
                      <Input value={String(prescription.left_eye || 'N/A')} readOnly className="bg-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lens Recommendations */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Optometrist Recommendations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Recommended Lens Type</Label>
                  <Input value={prescription.lens_type || 'N/A'} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Recommended Coating</Label>
                  <Input value={prescription.coating || 'N/A'} readOnly className="bg-gray-50" />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Additional Information</h4>
              {prescription.recommendations && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Optometrist Recommendations</Label>
                  <div className="bg-green-50 p-3 rounded text-sm border-l-4 border-green-400">
                    {prescription.recommendations}
                  </div>
                </div>
              )}
              
              {prescription.additional_notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Additional Notes</Label>
                  <div className="bg-gray-50 p-3 rounded text-sm border-l-4 border-gray-400">
                    {prescription.additional_notes}
                  </div>
                </div>
              )}
            </div>

            {/* Manufacturing Notes */}
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <h5 className="font-semibold text-yellow-800 mb-2">📋 Manufacturing Guidelines</h5>
              <p className="text-sm text-yellow-700">
                Use this prescription data to ensure the manufactured lenses provide optimal vision correction. 
                Pay special attention to the specific measurements for each eye and follow the optometrist's recommendations for lens type and coating.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Glass Order Specifications Card - Hidden for staff */}
      {!isStaff && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-purple-600" />
            <span>Glass Order Specifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lens Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Lens Type</Label>
              <Select value={glassOrderDetails.lensType} onValueChange={(value) => 
                setGlassOrderDetails(prev => ({ ...prev, lensType: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select lens type" />
                </SelectTrigger>
                <SelectContent>
                  {lensTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Lens Material</Label>
              <Select value={glassOrderDetails.lensMaterial} onValueChange={(value) => 
                setGlassOrderDetails(prev => ({ ...prev, lensMaterial: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select lens material" />
                </SelectTrigger>
                <SelectContent>
                  {lensMaterials.map(material => (
                    <SelectItem key={material} value={material}>{material}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lens Coatings */}
          <div>
            <Label>Lens Coatings & Features</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Select value={glassOrderDetails.lensCoating} onValueChange={(value) => 
                  setGlassOrderDetails(prev => ({ ...prev, lensCoating: value }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select coating" />
                  </SelectTrigger>
                  <SelectContent>
                    {lensCoatings.map(coating => (
                      <SelectItem key={coating} value={coating}>{coating}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="blueLight" 
                    checked={glassOrderDetails.blueLightFilter}
                    onCheckedChange={(checked) => 
                      setGlassOrderDetails(prev => ({ ...prev, blueLightFilter: !!checked }))
                    }
                  />
                  <Label htmlFor="blueLight">Blue Light Filter</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="progressive" 
                    checked={glassOrderDetails.progressiveLens}
                    onCheckedChange={(checked) => 
                      setGlassOrderDetails(prev => ({ ...prev, progressiveLens: !!checked }))
                    }
                  />
                  <Label htmlFor="progressive">Progressive Lens</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Frame Specifications */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Frame Material</Label>
              <Select value={glassOrderDetails.frameMaterial} onValueChange={(value) => 
                setGlassOrderDetails(prev => ({ ...prev, frameMaterial: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select frame material" />
                </SelectTrigger>
                <SelectContent>
                  {frameMaterials.map(material => (
                    <SelectItem key={material} value={material}>{material}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Frame Color</Label>
              <Input 
                placeholder="e.g., Black, Brown, Silver"
                value={glassOrderDetails.frameColor}
                onChange={(e) => setGlassOrderDetails(prev => ({ ...prev, frameColor: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Lens Color</Label>
              <Input 
                placeholder="e.g., Clear, Tinted, Gradient"
                value={glassOrderDetails.lensColor}
                onChange={(e) => setGlassOrderDetails(prev => ({ ...prev, lensColor: e.target.value }))}
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <Label>Special Instructions for Manufacturer</Label>
            <Textarea 
              placeholder="Any specific requirements, measurements, or special instructions for the manufacturer..."
              value={glassOrderDetails.specialInstructions}
              onChange={(e) => setGlassOrderDetails(prev => ({ ...prev, specialInstructions: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Manufacturer Notes */}
          <div>
            <Label>Manufacturer Contact Notes</Label>
            <Textarea 
              placeholder="Additional notes for contacting the manufacturer, priority level, delivery requirements..."
              value={glassOrderDetails.manufacturerNotes}
              onChange={(e) => setGlassOrderDetails(prev => ({ ...prev, manufacturerNotes: e.target.value }))}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Receipt Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-orange-600" />
            <span>Service Invoice</span>
          </CardTitle>
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
            <Button onClick={onSubmit} className="bg-green-600 hover:bg-green-700">
              {isStaff ? 'Save Receipt' : 'Save Receipt & Glass Order'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedStaffCreateReceipt;
