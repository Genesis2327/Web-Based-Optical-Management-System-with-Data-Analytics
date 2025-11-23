<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Appointment;
use App\Models\Reservation;
use App\Models\BranchStock;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class BranchAnalyticsController extends Controller
{
    /**
     * Get branch performance analytics
     */
    public function getBranchPerformance(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        // Only admin can view all branch analytics
        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can view branch analytics.'
            ], 403);
        }

        $branches = Branch::where('is_active', true)->get();
        $branchIds = $branches->pluck('id');
        
        // Get all data in optimized queries
        $thirtyDaysAgo = Carbon::now()->subDays(30);
        $sixtyDaysAgo = Carbon::now()->subDays(60);
        
        // Get appointments data for all branches
        $appointmentsData = DB::table('appointments')
            ->select('branch_id', 'patient_id', 'appointment_date')
            ->whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('appointment_date', '>=', $thirtyDaysAgo)
            ->get()
            ->groupBy('branch_id');
            
        $previousAppointmentsData = DB::table('appointments')
            ->select('branch_id', DB::raw('COUNT(*) as count'))
            ->whereIn('branch_id', $branchIds)
            ->whereBetween('appointment_date', [$sixtyDaysAgo, $thirtyDaysAgo])
            ->where('status', 'completed')
            ->groupBy('branch_id')
            ->pluck('count', 'branch_id');
            
        // Get reservations data for all branches (using Eloquent to properly calculate total_price)
        $reservationsData = \App\Models\Reservation::with('product')
            ->whereIn('branch_id', $branchIds)
            ->whereIn('status', ['approved', 'completed'])
            ->where('created_at', '>=', $thirtyDaysAgo)
            ->get()
            ->groupBy('branch_id');
            
        // Get inventory data for all branches
        $inventoryData = DB::table('branch_stock')
            ->select('branch_id', DB::raw('COUNT(*) as total_items'), 
                     DB::raw('SUM(CASE WHEN (stock_quantity - reserved_quantity) < 5 THEN 1 ELSE 0 END) as low_stock_items'))
            ->whereIn('branch_id', $branchIds)
            ->groupBy('branch_id')
            ->get()
            ->keyBy('branch_id');

        $branchPerformance = [];

        foreach ($branches as $branch) {
            $branchId = $branch->id;
            
            // Get appointments for this branch
            $appointments = $appointmentsData->get($branchId, collect());
            $reservations = $reservationsData->get($branchId, collect());
            $inventory = $inventoryData->get($branchId, (object)['total_items' => 0, 'low_stock_items' => 0]);

            // Calculate revenue (total_price is a calculated attribute, not a column)
            $reservationRevenue = $reservations->sum(function ($reservation) {
                return $reservation->quantity * ($reservation->product->price ?? 0);
            });
            $revenue = $reservationRevenue + ($appointments->count() * 500);

            // Get unique patients
            $uniquePatients = $appointments->pluck('patient_id')->unique()->count();

            // Calculate growth
            $previousAppointments = $previousAppointmentsData->get($branchId, 0);
            $currentAppointments = $appointments->count();
            $growth = $previousAppointments > 0 
                ? (($currentAppointments - $previousAppointments) / $previousAppointments) * 100 
                : 0;

            $branchPerformance[] = [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'address' => $branch->address,
                'revenue' => $revenue,
                'patients' => $uniquePatients,
                'appointments' => $currentAppointments,
                'growth' => round($growth, 1),
                'inventory_items' => $inventory->total_items,
                'low_stock_alerts' => $inventory->low_stock_items,
                'satisfaction' => 4.5 + (rand(0, 10) / 10), // Mock satisfaction score
                'is_active' => $branch->is_active
            ];
        }

        // Calculate unique patients across ALL branches (not summing branch totals to avoid double-counting)
        // Use proper MySQL distinct count syntax
        $result = DB::table('appointments')
            ->whereIn('branch_id', $branchIds)
            ->where('appointment_date', '>=', $thirtyDaysAgo)
            ->select(DB::raw('COUNT(DISTINCT patient_id) as unique_count'))
            ->first();
        
        $uniquePatientsTotal = $result ? (int)$result->unique_count : 0;
        
        // Fallback: If query builder approach doesn't work, use Eloquent with collection
        if ($uniquePatientsTotal === 0) {
            $appointmentCount = Appointment::whereIn('branch_id', $branchIds)
                ->where('appointment_date', '>=', $thirtyDaysAgo)
                ->count();
            
            // Only use fallback if there are actually appointments
            if ($appointmentCount > 0) {
                $uniquePatientsTotal = Appointment::whereIn('branch_id', $branchIds)
                    ->where('appointment_date', '>=', $thirtyDaysAgo)
                    ->get()
                    ->pluck('patient_id')
                    ->unique()
                    ->count();
            }
        }

        return response()->json([
            'branches' => $branchPerformance,
            'summary' => [
                'total_revenue' => collect($branchPerformance)->sum('revenue'),
                'total_patients' => $uniquePatientsTotal, // Unique patients across all branches (not summed)
                'total_appointments' => collect($branchPerformance)->sum('appointments'),
                'average_growth' => collect($branchPerformance)->avg('growth'),
                'total_branches' => count($branchPerformance)
            ]
        ]);
    }

    /**
     * Get branch-specific analytics
     */
    public function getBranchAnalytics(Branch $branch): JsonResponse
    {
        $user = Auth::user();
        
        // Admin can view any branch, staff can only view their own branch
        if (!$user || 
            ($user->role->value !== 'admin' && $user->branch_id !== $branch->id)) {
            return response()->json([
                'message' => 'Unauthorized to view this branch analytics.'
            ], 403);
        }

        // Get appointments for this branch (last 30 days)
        $appointments = Appointment::where('branch_id', $branch->id)
            ->where('appointment_date', '>=', Carbon::now()->subDays(30))
            ->get();

        // Get reservations for this branch (last 30 days)
        $reservations = Reservation::where('branch_id', $branch->id)
            ->where('created_at', '>=', Carbon::now()->subDays(30))
            ->get();

        // Get inventory status
        $inventoryItems = BranchStock::where('branch_id', $branch->id)->get();
        $lowStockItems = $inventoryItems->where('available_quantity', '<', 5)->count();

        // Get staff count for this branch
        $staffCount = User::where('branch_id', $branch->id)
            ->whereIn('role', ['staff', 'optometrist'])
            ->count();

        return response()->json([
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'address' => $branch->address,
                'phone' => $branch->phone,
                'email' => $branch->email,
                'is_active' => $branch->is_active
            ],
            'analytics' => [
                'appointments' => [
                    'total' => $appointments->count(),
                    'completed' => $appointments->where('status', 'completed')->count(),
                    'pending' => $appointments->where('status', 'scheduled')->count(),
                    'cancelled' => $appointments->where('status', 'cancelled')->count()
                ],
                'reservations' => [
                    'total' => $reservations->count(),
                    'completed' => $reservations->where('status', 'completed')->count(),
                    'pending' => $reservations->where('status', 'pending')->count(),
                    'rejected' => $reservations->where('status', 'rejected')->count()
                ],
                'inventory' => [
                    'total_items' => $inventoryItems->count(),
                    'in_stock' => $inventoryItems->where('available_quantity', '>', 0)->count(),
                    'low_stock' => $lowStockItems,
                    'out_of_stock' => $inventoryItems->where('available_quantity', '<=', 0)->count()
                ],
                'staff' => [
                    'total' => $staffCount,
                    'optometrists' => User::where('branch_id', $branch->id)->where('role', 'optometrist')->count(),
                    'staff' => User::where('branch_id', $branch->id)->where('role', 'staff')->count()
                ]
            ]
        ]);
    }

    /**
     * Get product availability across branches
     */
    public function getProductAvailability(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $productId = $request->get('product_id');
        $branchId = $request->get('branch_id');

        $query = BranchStock::with(['product', 'branch'])
            ->where('stock_quantity', '>', 0);

        if ($productId) {
            $query->where('product_id', $productId);
        }

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        // If user is not admin, only show their branch
        if ($user->role->value !== 'admin' && $user->branch_id) {
            $query->where('branch_id', $user->branch_id);
        }

        $availability = $query->get()->map(function ($stock) {
            return [
                'product_id' => $stock->product_id,
                'product_name' => $stock->product->name,
                'branch_id' => $stock->branch_id,
                'branch_name' => $stock->branch->name,
                'branch_code' => $stock->branch->code,
                'available_quantity' => $stock->available_quantity,
                'stock_quantity' => $stock->stock_quantity,
                'reserved_quantity' => $stock->reserved_quantity,
                'is_available' => $stock->available_quantity > 0
            ];
        });

        return response()->json([
            'availability' => $availability,
            'summary' => [
                'total_products' => $availability->pluck('product_id')->unique()->count(),
                'total_branches' => $availability->pluck('branch_id')->unique()->count(),
                'in_stock_items' => $availability->where('is_available', true)->count()
            ]
        ]);
    }
}
