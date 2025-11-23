import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Package, Eye, FileText } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface Prescription {
  id: number;
  issue_date: string;
  expiry_date: string;
  prescription_data?: any;
  lens_type?: string;
}

interface Reservation {
  id: number;
  user_id?: number;
  product_id: number;
  product?: {
    id: number;
    name: string;
    price: number;
  };
  user?: {
    id: number;
    name: string;
  };
  quantity: number;
  status: string;
  branch_id: number;
  branch?: {
    id: number;
    name: string;
  };
}

interface Appointment {
  id: number;
  appointment_date: string;
  type: string;
  status?: string;
  branch_id: number;
}

interface CreateGlassOrderFromPrescriptionProps {
  patientId: number;
  patientName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateGlassOrderFromPrescription: React.FC<CreateGlassOrderFromPrescriptionProps> = ({
  patientId,
  patientName,
  onSuccess,
  onCancel
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<number | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<number | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    frame_type: '',
    lens_type: '',
    lens_coating: '',
    blue_light_filter: false, // Only used if lens type is not Anti-Radiation Lens
    lens_material: '',
    frame_material: '',
    frame_color: '',
    lens_color: '',
    special_instructions: '',
    manufacturer_notes: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  useEffect(() => {
    fetchData();
  }, [patientId]);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch prescriptions
      try {
        const prescriptionsRes = await axios.get(`${API_BASE_URL}/prescriptions/patient/${patientId}`, { headers });
        // Handle different response structures and ensure it's always an array
        let prescriptionsData = [];
        if (prescriptionsRes.data) {
          if (Array.isArray(prescriptionsRes.data)) {
            prescriptionsData = prescriptionsRes.data;
          } else if (Array.isArray(prescriptionsRes.data.prescriptions)) {
            prescriptionsData = prescriptionsRes.data.prescriptions;
          } else if (Array.isArray(prescriptionsRes.data.data)) {
            prescriptionsData = prescriptionsRes.data.data;
          }
        }
        setPrescriptions(prescriptionsData);
      } catch (prescriptionError: any) {
        console.error('Error fetching prescriptions:', prescriptionError);
        setPrescriptions([]); // Set to empty array on error
        if (prescriptionError.response?.status !== 404) {
          toast({
            title: 'Warning',
            description: 'Failed to load prescriptions. You can still create a glass order.',
            variant: 'default'
          });
        }
      }

      // Fetch reservations - filter by patient and approved status
      try {
        const reservationsRes = await axios.get(`${API_BASE_URL}/reservations`, { 
          headers,
          params: { status: 'approved' }
        });
        let allReservations = [];
        if (reservationsRes.data) {
          if (Array.isArray(reservationsRes.data)) {
            allReservations = reservationsRes.data;
          } else if (Array.isArray(reservationsRes.data.reservations)) {
            allReservations = reservationsRes.data.reservations;
          } else if (Array.isArray(reservationsRes.data.data)) {
            allReservations = reservationsRes.data.data;
          }
        }
        // Filter by patient_id (user_id in reservations table)
        const patientReservations = allReservations.filter((r: Reservation) => r.user_id === patientId || (r as any).user?.id === patientId);
        setReservations(patientReservations);
      } catch (reservationError: any) {
        console.error('Error fetching reservations:', reservationError);
        setReservations([]); // Set to empty array on error
      }

      // Fetch appointments
      try {
        const appointmentsRes = await axios.get(`${API_BASE_URL}/appointments`, {
          headers,
          params: { patient_id: patientId }
        });
        let allAppointments = [];
        if (appointmentsRes.data) {
          if (Array.isArray(appointmentsRes.data)) {
            allAppointments = appointmentsRes.data;
          } else if (Array.isArray(appointmentsRes.data.appointments)) {
            allAppointments = appointmentsRes.data.appointments;
          } else if (Array.isArray(appointmentsRes.data.data)) {
            allAppointments = appointmentsRes.data.data;
          }
        }
        setAppointments(allAppointments.filter((apt: Appointment) => apt.status === 'completed' || apt.status === 'scheduled'));
      } catch (appointmentError: any) {
        console.error('Error fetching appointments:', appointmentError);
        setAppointments([]); // Set to empty array on error
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      // Ensure all state is set to empty arrays
      setPrescriptions([]);
      setReservations([]);
      setAppointments([]);
      toast({
        title: 'Error',
        description: 'Failed to load some data. You can still create a glass order.',
        variant: 'destructive'
      });
    }
  };

  const handlePrescriptionChange = (prescriptionId: string) => {
    const id = parseInt(prescriptionId);
    setSelectedPrescription(id);
    const prescription = prescriptions.find(p => p.id === id);
    if (prescription) {
      // Auto-fill lens type from prescription
      if (prescription.lens_type) {
        setFormData(prev => ({ ...prev, lens_type: prescription.lens_type || '' }));
      }
      // Auto-fill from prescription_data if available
      if (prescription.prescription_data) {
        const data = prescription.prescription_data;
        setFormData(prev => ({
          ...prev,
          lens_type: data.lens_type || prev.lens_type,
          // Coating removed - not part of client services
          // Removed progressive_lens and bifocal_lens (not part of client services)
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPrescription) {
      toast({
        title: 'Validation Error',
        description: 'Please select a prescription',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedReservation) {
      toast({
        title: 'Validation Error',
        description: 'Please select a reserved frame',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedAppointment) {
      toast({
        title: 'Validation Error',
        description: 'Please select an appointment',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const selectedReservationData = reservations.find(r => r.id === selectedReservation);
      const selectedPrescriptionData = prescriptions.find(p => p.id === selectedPrescription);
      const selectedAppointmentData = appointments.find(a => a.id === selectedAppointment);

      if (!selectedReservationData || !selectedAppointmentData) {
        throw new Error('Selected data not found');
      }

      // Prepare reserved products array
      const reservedProducts = [{
        reservation_id: selectedReservationData.id,
        product_id: selectedReservationData.product_id,
        product_name: selectedReservationData.product?.name || 'Frame',
        quantity: selectedReservationData.quantity,
        unit_price: selectedReservationData.product?.price || 0,
        description: `Frame: ${selectedReservationData.product?.name || 'Unknown'}`
      }];

      // Prepare prescription data
      const prescriptionData = selectedPrescriptionData.prescription_data || {
        lens_type: selectedPrescriptionData.lens_type || formData.lens_type,
        ...formData
      };

      const payload = {
        appointment_id: selectedAppointment,
        patient_id: patientId,
        prescription_id: selectedPrescription,
        reserved_products: reservedProducts,
        prescription_data: prescriptionData,
        frame_type: formData.frame_type || 'Full Frame',
        lens_type: formData.lens_type,
        lens_coating: '', // Coating removed - not part of client services
        // Blue Light Filter is automatically true if Anti-Radiation Lens is selected
        blue_light_filter: formData.lens_type === 'anti_radiation' || formData.blue_light_filter,
        progressive_lens: false, // Not part of client services
        bifocal_lens: false, // Not part of client services
        lens_material: formData.lens_material,
        frame_material: formData.frame_material,
        frame_color: formData.frame_color,
        lens_color: formData.lens_color,
        special_instructions: formData.special_instructions,
        manufacturer_notes: formData.manufacturer_notes,
        priority: formData.priority,
      };

      const response = await axios.post(`${API_BASE_URL}/glass-orders`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      toast({
        title: 'Success',
        description: `Glass order created successfully! Order #${response.data.data.formatted_number}`
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error creating glass order:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create glass order',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedReservationData = reservations.find(r => r.id === selectedReservation);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Create Glass Order for {patientName}
        </CardTitle>
        <CardDescription>
          Create a glass order from prescription and reserved frame
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prescription Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Select Prescription *
            </Label>
            <Select
              value={selectedPrescription?.toString() || ''}
              onValueChange={handlePrescriptionChange}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a prescription" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(prescriptions) && prescriptions.length > 0 ? (
                  prescriptions.map((prescription) => (
                    <SelectItem key={prescription.id} value={prescription.id.toString()}>
                      Prescription #{prescription.id} - {prescription.issue_date ? new Date(prescription.issue_date).toLocaleDateString() : 'N/A'}
                      {prescription.expiry_date && ` (Expires: ${new Date(prescription.expiry_date).toLocaleDateString()})`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-prescription" disabled>No prescriptions available</SelectItem>
                )}
              </SelectContent>
            </Select>
            {(!Array.isArray(prescriptions) || prescriptions.length === 0) && (
              <p className="text-sm text-amber-600">No prescriptions found for this patient</p>
            )}
          </div>

          {/* Reservation Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Select Reserved Frame *
            </Label>
            <Select
              value={selectedReservation?.toString() || ''}
              onValueChange={(value) => setSelectedReservation(parseInt(value))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reserved frame" />
              </SelectTrigger>
              <SelectContent>
                {reservations.map((reservation) => (
                  <SelectItem key={reservation.id} value={reservation.id.toString()}>
                    {reservation.product?.name || `Reservation #${reservation.id}`} 
                    {reservation.branch && ` - ${reservation.branch.name}`}
                    {reservation.status && ` (${reservation.status})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reservations.length === 0 && (
              <p className="text-sm text-amber-600">No approved reservations found for this patient</p>
            )}
            {selectedReservationData && (
              <div className="bg-blue-50 p-3 rounded text-sm">
                <p><strong>Frame:</strong> {selectedReservationData.product?.name || 'Unknown'}</p>
                <p><strong>Quantity:</strong> {selectedReservationData.quantity}</p>
                <p><strong>Price:</strong> ₱{Number(selectedReservationData.product?.price || 0).toFixed(2)}</p>
                {selectedReservationData.branch && (
                  <p><strong>Branch:</strong> {selectedReservationData.branch.name}</p>
                )}
              </div>
            )}
          </div>

          {/* Appointment Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Select Appointment *
            </Label>
            <Select
              value={selectedAppointment?.toString() || ''}
              onValueChange={(value) => setSelectedAppointment(parseInt(value))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an appointment" />
              </SelectTrigger>
              <SelectContent>
                {appointments.map((appointment) => (
                  <SelectItem key={appointment.id} value={appointment.id.toString()}>
                    {new Date(appointment.appointment_date).toLocaleDateString()} - {appointment.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {appointments.length === 0 && (
              <p className="text-sm text-amber-600">No appointments found for this patient</p>
            )}
          </div>

          {/* Glass Specifications */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold">Glass Specifications</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lens Type</Label>
                <Select
                  value={formData.lens_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, lens_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lens type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinary">Ordinary Lens</SelectItem>
                    <SelectItem value="anti_radiation">Anti-Radiation Lens</SelectItem>
                    <SelectItem value="photochromic_lens">Photochromic Lens</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lens Material</Label>
                <Select
                  value={formData.lens_material}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, lens_material: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cr39">CR-39 Plastic</SelectItem>
                    <SelectItem value="polycarbonate">Polycarbonate</SelectItem>
                    <SelectItem value="trivex">Trivex</SelectItem>
                    <SelectItem value="high-index">High Index</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lens Coating removed - not part of client services */}

              <div className="space-y-2">
                <Label>Frame Material</Label>
                <Select
                  value={formData.frame_material}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, frame_material: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frame material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="metal">Metal</SelectItem>
                    <SelectItem value="acetate">Acetate</SelectItem>
                    <SelectItem value="titanium">Titanium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Special Features */}
            <div className="space-y-2">
              <Label>Special Features</Label>
              <div className="flex flex-wrap gap-4">
                {/* Blue Light Filter is automatically included with Anti-Radiation Lens */}
                {formData.lens_type !== 'anti_radiation' && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="blue_light"
                      checked={formData.blue_light_filter}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, blue_light_filter: !!checked }))}
                    />
                    <Label htmlFor="blue_light" className="font-normal">Blue Light Filter (Additional)</Label>
                  </div>
                )}
                {formData.lens_type === 'anti_radiation' && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                    ℹ️ Blue Light Filter is included with Anti-Radiation Lens
                  </div>
                )}
                {/* Removed non-client lens features: Progressive, Bifocal */}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frame Color</Label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Black, Brown"
                  value={formData.frame_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, frame_color: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Lens Color</Label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Clear, Tinted"
                  value={formData.lens_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, lens_color: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <Textarea
                placeholder="Any specific requirements or special instructions for the manufacturer..."
                value={formData.special_instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Manufacturer Notes</Label>
              <Textarea
                placeholder="Priority level, delivery requirements, contact preferences..."
                value={formData.manufacturer_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer_notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Glass Order'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateGlassOrderFromPrescription;

