import React from 'react';
import { BarChart3, Users, Package, Banknote, Store, Award, RefreshCw } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import BranchFilter from '@/components/common/BranchFilter';
import { useBranch } from '@/contexts/BranchContext';
import { useQuery } from '@tanstack/react-query';
import { getBranchPerformance, BranchPerformance, BranchAnalyticsSummary } from '@/services/branchAnalyticsApi';
import { productAnalyticsApi, TopSellingProduct } from '@/services/productAnalyticsApi';
// RevenueAnalyticsCards moved to AnalyticsDashboard
import { formatPeso } from '@/utils/currency';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { selectedBranchId, setSelectedBranchId, isMultiBranch } = useBranch();

  // Fetch real branch performance data
  const { data: branchAnalytics, isLoading: branchLoading, error: branchError, refetch: refetchBranchData } = useQuery({
    queryKey: ['branch-performance'],
    queryFn: getBranchPerformance,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3, // Retry failed requests
  });

  // Fetch real top-selling products data
  const { data: topProductsData, isLoading: topProductsLoading, error: topProductsError, refetch: refetchTopProducts } = useQuery({
    queryKey: ['top-selling-products', selectedBranchId],
    queryFn: () => productAnalyticsApi.getTopSellingProducts({
      period: 30,
      branch_id: selectedBranchId !== 'all' ? parseInt(selectedBranchId) : undefined,
      limit: 4
    }),
    refetchInterval: 60000, // Refetch every minute
    retry: 3, // Retry failed requests
  });


  const allBranchData: BranchPerformance[] = (branchAnalytics as any)?.branches || [];
  const summary: BranchAnalyticsSummary | null = (branchAnalytics as any)?.summary || null;
  
  // Filter branch data based on selected branch
  const branchData = selectedBranchId === 'all' 
    ? allBranchData 
    : allBranchData.filter(branch => branch.id.toString() === selectedBranchId);

  // Get real top-selling products data
  const topProducts: TopSellingProduct[] = (topProductsData as any)?.top_products || [];

  // Calculate metrics based on filtered data
  const monthlyRevenue = selectedBranchId === 'all' 
    ? (summary?.total_revenue || 0)
    : branchData.reduce((sum, branch) => sum + branch.revenue, 0);
    
  const totalPatients = selectedBranchId === 'all' 
    ? (summary?.total_patients || 0)
    : branchData.reduce((sum, branch) => sum + branch.patients, 0);
    
  const avgGrowth = selectedBranchId === 'all' 
    ? (summary?.average_growth || 0)
    : branchData.length > 0 
      ? branchData.reduce((sum, branch) => sum + branch.growth, 0) / branchData.length
      : 0;

  return (
    <div className="admin-dashboard-container space-y-6">
      <style>{`
        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */
        
        @media (max-width: 319px) {
          .admin-dashboard-container {
            padding: 0.5rem;
          }
        }
        
        @media (min-width: 320px) and (max-width: 480px) {
          .admin-dashboard-container {
            padding: 0.75rem;
          }
          .admin-dashboard-container h1 {
            font-size: 1.5rem;
          }
          .admin-dashboard-container .grid {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (min-width: 481px) and (max-width: 767px) {
          .admin-dashboard-container {
            padding: 1rem;
          }
          .admin-dashboard-container .grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1024px) {
          .admin-dashboard-container {
            padding: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) {
          .admin-dashboard-container {
            padding: 2rem;
          }
        }
        
        @media (hover: none) and (pointer: coarse) {
          .admin-dashboard-container * {
            min-height: 44px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .admin-dashboard-container * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      {/* Welcome Section */}
      <div className="bg-gradient-admin rounded-lg p-4 sm:p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Administrative Dashboard</h1>
            <p className="text-admin-foreground/90 text-sm sm:text-base">
              Complete overview of all clinic operations, performance metrics, and system management.
            </p>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-3">
              <BranchFilter
                selectedBranchId={selectedBranchId}
                onBranchChange={setSelectedBranchId}
                showAllOption={true}
                label="Filter by Branch"
                placeholder="All branches"
                useAdminData={true}
                className="w-full sm:min-w-[200px]"
              />
              {selectedBranchId !== 'all' && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-fit">
                  Showing: {branchData[0]?.name || 'Selected Branch'}
                </Badge>
              )}
              {selectedBranchId === 'all' && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
                  Showing: All Branches
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                refetchBranchData();
                refetchTopProducts();
              }}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto sm:min-w-[120px] disabled:opacity-50 transition-all duration-200 hover:bg-blue-50 hover:border-blue-300"
              disabled={branchLoading || topProductsLoading}
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${(branchLoading || topProductsLoading) ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{(branchLoading || topProductsLoading) ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </div>


      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <DashboardCard
          title="Monthly Revenue"
          value={formatPeso(monthlyRevenue)}
          description={selectedBranchId === 'all' ? "Across all branches" : `For ${branchData[0]?.name || 'selected branch'}`}
          icon={Banknote}
          action={{
            label: 'View Analytics',
            onClick: () => navigate('/admin/analytics'),
            variant: 'admin'
          }}
          gradient
        />
        
        <DashboardCard
          title={selectedBranchId === 'all' ? "Total Unique Patients" : "Patients Served"}
          value={totalPatients}
          description={selectedBranchId === 'all' 
            ? "Unique patients across all branches (last 30 days)" 
            : `Unique patients at ${branchData[0]?.name || 'selected branch'} (last 30 days)`}
          tooltip={selectedBranchId === 'all' 
            ? "Counts each patient only once across all branches. Branch totals may sum to more than this if patients visit multiple branches."
            : "Unique patients who visited this branch. A patient visiting multiple branches is counted in each branch."}
          icon={Users}
          action={{
            label: 'User Management',
            onClick: () => navigate('/admin/users'),
            variant: 'admin'
          }}
          gradient
        />
        
        <DashboardCard
          title="Total Inventory"
          value="Manage"
          description={selectedBranchId === 'all' ? "Items across branches" : `Items at ${branchData[0]?.name || 'selected branch'}`}
          icon={Package}
          action={{
            label: 'Manage Inventory',
            onClick: () => navigate('/admin/inventory'),
            variant: 'admin'
          }}
          gradient
        />
        
        <DashboardCard
          title="Active Branches"
          value={selectedBranchId === 'all' ? allBranchData.length : branchData.length}
          description={selectedBranchId === 'all' ? "All locations" : "Selected location"}
          icon={Store}
          action={{
            label: 'Branch Analytics',
            onClick: () => navigate('/admin/analytics'),
            variant: 'admin'
          }}
          gradient
        />
        
        <DashboardCard
          title="Product Gallery"
          value="Manage"
          description="Add, edit, delete products"
          icon={Package}
          action={{
            label: 'Manage Products',
            onClick: () => navigate('/admin/products'),
            variant: 'admin'
          }}
          gradient
        />
      </div>

      {/* Revenue Analytics Cards moved to Analytics page */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Performance */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-admin" />
              <span>Branch Performance</span>
            </CardTitle>
            <CardDescription>
              {selectedBranchId === 'all' 
                ? 'Revenue and patient metrics by location' 
                : `Performance for ${branchData[0]?.name || 'selected branch'}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {branchLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Loading branch performance...</span>
              </div>
            ) : branchError ? (
              <div className="text-center py-8 text-red-500">
                <p>Failed to load branch performance data</p>
                <Button 
                  variant="admin" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => refetchBranchData()}
                >
                  Retry
                </Button>
              </div>
            ) : branchData.length > 0 ? (
              <>
                {branchData.map((branch) => (
                  <div key={branch.id} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{branch.name}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge className={branch.growth > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {branch.growth > 0 ? '+' : ''}{branch.growth}%
                        </Badge>
                        <Badge variant={branch.is_active ? "default" : "secondary"}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Revenue</p>
                        <p className="font-semibold">{formatPeso(branch.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Patients</p>
                        <p className="font-semibold">{branch.patients}</p>
                        {branch.patient_visits && branch.patient_visits > branch.patients && (
                          <p className="text-xs text-slate-500">({branch.patient_visits} visits)</p>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-600">Appointments</p>
                        <p className="font-semibold">{branch.appointments}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Low Stock Alerts</p>
                        <p className="font-semibold text-red-600">{branch.low_stock_alerts}</p>
                      </div>
                    </div>
                    <Progress value={Math.min((branch.revenue / 50000) * 100, 100)} className="mt-2 h-2" />
                  </div>
                ))}
                <Button 
                  variant="admin" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => navigate('/admin/analytics')}
                >
                  Detailed Branch Report
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No branch performance data available.</p>
                <Button 
                  variant="admin" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => refetchBranchData()}
                >
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-admin" />
              <span>Top Selling Products</span>
            </CardTitle>
            <CardDescription>
              {selectedBranchId === 'all' 
                ? 'Best performing products this month' 
                : `Best performing products at ${branchData[0]?.name || 'selected branch'}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProductsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-admin"></div>
                <span className="ml-2">Loading products...</span>
              </div>
            ) : topProductsError ? (
              <div className="text-center py-8 text-red-500">
                <p>Failed to load top products data</p>
                <Button 
                  variant="admin" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => refetchTopProducts()}
                >
                  Retry
                </Button>
              </div>
            ) : topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{product.name}</h4>
                    <p className="text-sm text-slate-600">{product.units_sold} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatPeso(product.revenue)}</p>
                    <p className={`text-sm ${product.trend_percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.trend_percentage > 0 ? '+' : ''}{product.trend_percentage}%
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No product sales data available</p>
                <p className="text-xs mt-1">Data will appear when products are sold</p>
              </div>
            )}
            <Button 
              variant="admin" 
              size="sm" 
              className="w-full mt-3"
              onClick={() => navigate('/admin/products')}
            >
              Manage Products
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default AdminDashboard;
