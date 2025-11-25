import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { setupAxiosInterceptors } from "@/utils/axiosInterceptor";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Login from "@/components/auth/Login";
import Register from "@/components/auth/Register";
import ForgotPassword from "@/components/auth/ForgotPassword";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import OptometristDashboardGrouped from "@/components/optometrist/OptometristDashboardGrouped";
import StaffDashboard from "@/components/dashboard/StaffDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import AppointmentBooking from "@/components/appoinments/AppointmentBooking";
import PrescriptionViewer from "@/components/prescriptions/PrescriptionViewer";
import InventoryManagement from "@/components/inventory/InventoryManagement";
import RoleBasedInventoryManagement from "@/features/inventory/components/RoleBasedInventoryManagement";
import StaffInventoryManagement from "@/features/inventory/components/StaffInventoryManagement";
import UnifiedStaffInventory from "@/features/inventory/components/UnifiedStaffInventory";
import AdminCentralInventory from "@/features/inventory/components/AdminCentralInventory";
import AdminConsolidatedInventory from "@/features/inventory/components/AdminConsolidatedInventory";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import PatientManagement from "@/components/patients/PatientManagement";
import ComprehensivePatientManagement from "@/features/patients/components/ComprehensivePatientManagement";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import OptometristAnalytics from "@/features/analytics/components/OptometristAnalytics";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import FAQ from "./pages/FAQ";
import BookAppointmentPage from "./pages/BookAppointmentPage";

// Customer Components
import CustomerAppointments from "@/features/customer/components/CustomerAppointments";
import CustomerVisionHistory from "@/features/customer/components/CustomerVisionHistory";
import CustomerPrescriptions from "@/features/customer/components/CustomerPrescriptions";
import CustomerFeedback from "@/features/feedback/components/CustomerFeedback";
import CustomerReceipts from "@/features/customer/components/CustomerReceipts";
import CustomerProductTracking from "@/features/customer/components/CustomerProductTracking";
import { CustomerAppointmentsLocalStorage } from "@/features/customer/components/CustomerAppointmentsLocalStorage";
import { CustomerPrescriptionsLocalStorage } from "@/features/customer/components/CustomerPrescriptionsLocalStorage";

// Inquiry Components

// Product Components
import ProductGallery from "@/features/products/components/MultiBranchProductGallery";
import ProductDetails from "@/features/products/components/ProductDetails";
import ReservationList from "@/features/products/components/ReservationList";
import { ProductGalleryLocalStorage } from "@/features/products/components/ProductGalleryLocalStorage";
import { ProductGallerySimple } from "@/features/products/components/ProductGallerySimple";
import { ProductGalleryDatabase } from "@/features/products/components/ProductGalleryDatabase";
import { ProductGalleryTest } from "@/features/products/components/ProductGalleryTest";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Staff Components
import StaffReservationDashboard from "@/features/staff/components/StaffReservationDashboard";
import UnifiedReservationsDashboard from "@/features/staff/components/UnifiedReservationsDashboard";
import StaffRestockRequests from "@/features/staff/components/StaffRestockRequests";
import StaffCreateReceipt from "@/features/receipts/components/StaffCreateReceipt";
import EnhancedStaffCreateReceipt from "@/features/receipts/components/EnhancedStaffCreateReceipt";
import StaffProductTrackingDashboard from "@/features/products/components/StaffProductTrackingDashboard";

// Admin Components
import AdminStockManagement from "@/features/admin/components/AdminStockManagement";
import AdminProductManagement from "@/features/admin/components/AdminProductManagement";
import AdminProductTrackingDashboard from "@/features/admin/components/AdminProductTrackingDashboard";
import EOLensManagement from "@/features/admin/components/EOLensManagement";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";

// Optometrist Components
import OptometristAppointments from "@/features/appointments/components/OptometristAppointments";
import StaffAppointments from "@/features/appointments/components/StaffAppointments";
import OptometristPatientRecords from "@/features/patients/components/OptometristPatientRecords";
import OptometristPrescriptionManagement from "@/features/prescriptions/components/OptometristPrescriptionManagement";
import OptometristSchedule from "@/components/schedule/OptometristSchedule";
import StaffSchedule from "@/components/schedule/StaffSchedule";
import UserProfile from "@/components/user/UserProfile";
import AdminUserManagement from "@/components/admin/AdminUserManagement";
import BranchManagement from "@/components/admin/BranchManagement";
import EmployeeScheduleManagement from "@/components/admin/EmployeeScheduleManagement";
import LensTypeManagement from "@/components/admin/LensTypeManagement";
import { BranchProvider } from "@/contexts/BranchContext";
import { useParams } from "react-router-dom";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl, getAuthHeaders } from "@/config/api";
import { TransactionDashboard } from "@/components/transactions/TransactionDashboard";

const queryClient = new QueryClient();

// Initialize axios interceptors
setupAxiosInterceptors();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationProvider>
        <BranchProvider>
          <RealtimeProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/faq" element={<FAQ />} />

            {/* Customer Routes */}
            <Route path="/customer" element={
              <ProtectedRoute allowedRoles={['customer']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="appointments" element={<CustomerAppointments />} />
              <Route path="book-appointment" element={<BookAppointmentPage />} />
              <Route path="history" element={<CustomerVisionHistory />} />
              <Route path="prescriptions" element={<CustomerPrescriptions />} />
              <Route path="receipts" element={<CustomerReceipts />} />
              <Route path="feedback" element={<CustomerFeedback />} />
              <Route path="product-tracking" element={<CustomerProductTracking />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="products" element={<ProductGallery />} />
              <Route path="products/:productId" element={<ProductDetails />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="reservations" element={<ReservationList />} />
            </Route>

            {/* Optometrist Routes */}
            <Route path="/optometrist" element={
              <ProtectedRoute allowedRoles={['optometrist']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<OptometristDashboardGrouped />} />
              <Route path="appointments" element={<OptometristAppointments />} />
              <Route path="patients" element={<OptometristPatientRecords />} />
              <Route path="prescriptions" element={<OptometristPrescriptionManagement />} />
              <Route path="schedule" element={<OptometristSchedule />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="profile" element={<UserProfile />} />
            </Route>

            {/* Staff Routes */}
            <Route path="/staff" element={
              <ProtectedRoute allowedRoles={['staff']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<StaffDashboard />} />
              <Route path="appointments" element={<StaffAppointments />} />
              <Route path="schedule" element={<StaffSchedule />} />
              {/* Unified Reservations & Transactions Dashboard */}
              <Route path="reservations" element={<UnifiedReservationsDashboard />} />
              {/* Provide appointmentId via URL; wrapper component extracts param */}
              <Route path="create-receipt/:appointmentId" element={<CreateReceiptRouteWrapper />} />
              <Route path="restock-requests" element={<StaffRestockRequests />} />
              <Route path="product-tracking" element={<StaffProductTrackingDashboard />} />
              <Route path="inventory" element={<UnifiedStaffInventory />} />
              <Route path="inventory/legacy" element={<StaffInventoryManagement />} />
              <Route path="patients" element={<ComprehensivePatientManagement />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="notifications" element={<NotificationCenter />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
              <Route path="users" element={<AdminUserManagement />} />
              <Route path="branches" element={<BranchManagement />} />
              <Route path="lens-types" element={<LensTypeManagement />} />
              <Route path="inventory" element={<AdminCentralInventory />} />
              <Route path="inventory/consolidated" element={<AdminConsolidatedInventory />} />
              <Route path="stock-management" element={<AdminStockManagement />} />
              <Route path="products" element={
                <ErrorBoundary>
                  <AdminProductManagement />
                </ErrorBoundary>
              } />
              <Route path="eo-lenses" element={
                <ErrorBoundary>
                  <EOLensManagement />
                </ErrorBoundary>
              } />
              <Route path="product-tracking" element={<AdminProductTrackingDashboard />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="patients" element={<ComprehensivePatientManagement />} />
              <Route path="sales" element={<AnalyticsDashboard />} />
              <Route path="employee-schedules" element={<EmployeeScheduleManagement />} />
              <Route path="transactions" element={<TransactionDashboard />} />
              <Route path="profile" element={<UserProfile />} />
            </Route>

            {/* Redirects - These are handled by the main route groups above */}

            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
        </RealtimeProvider>
      </BranchProvider>
      </NotificationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

// Wrapper to map URL param to component props and fetch defaults
function CreateReceiptRouteWrapper() {
  const { appointmentId } = useParams();
  const id = Number(appointmentId);
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['appointment', id],
    enabled: !!id,
    queryFn: async () => {
      const resp = await fetch(getApiUrl(`/appointments/${id}`), { 
        headers: getAuthHeaders() 
      });
      if (!resp.ok) throw new Error('Failed to load appointment');
      return resp.json();
    }
  });
  const defaultName = data?.patient?.name || '';
  const defaultAddress = data?.patient?.address || '';
  const customerId = data?.patient?.id || data?.customer_id;
  return <EnhancedStaffCreateReceipt appointmentId={id} defaultCustomerName={defaultName} defaultAddress={defaultAddress} customerId={customerId} />;
}
