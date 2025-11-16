import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Receipt } from 'lucide-react';
import StaffReservationDashboard from './StaffReservationDashboard';
import AppointmentsAndReceipts from './AppointmentsAndReceipts';

/**
 * Unified Reservations & Transactions Dashboard for Staff
 * Combines:
 * - Customer Product Reservations
 * - Patient Transactions & Receipts
 */
const UnifiedReservationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('reservations');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reservations & Transactions</h1>
          <p className="text-gray-600 mt-1">Manage customer product reservations and create receipts for appointments</p>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto">
          <TabsTrigger value="reservations" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Product Reservations</span>
            <span className="sm:hidden">Reservations</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Receipts & Transactions</span>
            <span className="sm:hidden">Receipts</span>
          </TabsTrigger>
        </TabsList>

        {/* Product Reservations Tab */}
        <TabsContent value="reservations" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-staff" />
                Customer Product Reservations
              </CardTitle>
              <CardDescription>
                Approve, reject, and manage customer product reservations from your branch
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <StaffReservationDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patient Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-staff" />
                Appointments & Receipts
              </CardTitle>
              <CardDescription>
                Create receipts for completed appointments and view all patient transaction history
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <AppointmentsAndReceipts />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default UnifiedReservationsDashboard;

