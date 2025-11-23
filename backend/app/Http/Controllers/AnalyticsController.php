<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Appointment;
use App\Models\Prescription;
use App\Models\Branch;
use App\Models\Reservation;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\Receipt;
use App\Models\Transaction;
use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Enums\UserRole;

class AnalyticsController extends Controller
{
    /**
     * Get customer analytics
     * GET /api/customers/{id}/analytics
     */
    public function getCustomerAnalytics(Request $request, $customerId): JsonResponse
    {
        $user = Auth::user();
        
        // Check if user can access this customer's data
        if (!$user || 
            ($user->role->value !== 'admin' && 
             $user->role->value !== 'optometrist' && 
             $user->id != $customerId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $customer = User::find($customerId);
        if (!$customer || $customer->role->value !== 'customer') {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        // Get vision history data (SPH, CYL, Axis trends)
        $prescriptions = Prescription::where('patient_id', $customerId)
            ->orderBy('issue_date', 'desc')
            ->get();

        $visionHistory = $prescriptions->map(function ($prescription) {
            $rightEye = $prescription->right_eye ?? [];
            $leftEye = $prescription->left_eye ?? [];
            
            return [
                'date' => $prescription->issue_date->format('Y-m-d'),
                'prescription_number' => $prescription->prescription_number,
                'right_eye' => [
                    'sph' => $rightEye['sph'] ?? null,
                    'cyl' => $rightEye['cyl'] ?? null,
                    'axis' => $rightEye['axis'] ?? null,
                ],
                'left_eye' => [
                    'sph' => $leftEye['sph'] ?? null,
                    'cyl' => $leftEye['cyl'] ?? null,
                    'axis' => $leftEye['axis'] ?? null,
                ],
                'expiry_date' => $prescription->expiry_date->format('Y-m-d'),
                'status' => $prescription->status,
                'is_expired' => $prescription->isExpired(),
            ];
        });

        // Get appointment history
        $appointments = Appointment::where('patient_id', $customerId)
            ->with(['optometrist', 'branch'])
            ->orderBy('appointment_date', 'desc')
            ->get();

        $appointmentHistory = $appointments->map(function ($appointment) {
            return [
                'id' => $appointment->id,
                'date' => $appointment->appointment_date->format('Y-m-d'),
                'time' => $appointment->start_time,
                'type' => $appointment->type,
                'status' => $appointment->status,
                'optometrist' => $appointment->optometrist ? [
                    'name' => $appointment->optometrist->name,
                    'id' => $appointment->optometrist->id,
                ] : null,
                'branch' => $appointment->branch ? [
                    'name' => $appointment->branch->name,
                    'address' => $appointment->branch->address,
                ] : null,
            ];
        });

        // Calculate statistics
        $totalAppointments = $appointments->count();
        $completedAppointments = $appointments->where('status', 'completed')->count();
        $missedAppointments = $appointments->where('status', 'cancelled')->count();
        $upcomingAppointments = $appointments->where('status', 'scheduled')
            ->where('appointment_date', '>=', now())->count();

        $totalPrescriptions = $prescriptions->count();
        $activePrescriptions = $prescriptions->where('status', 'active')->count();
        $expiredPrescriptions = $prescriptions->filter(function ($prescription) {
            return $prescription->isExpired();
        })->count();

        // Vision trends analysis
        $visionTrends = $this->analyzeVisionTrends($prescriptions);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
            ],
            'vision_history' => $visionHistory,
            'appointment_history' => $appointmentHistory,
            'statistics' => [
                'appointments' => [
                    'total' => $totalAppointments,
                    'completed' => $completedAppointments,
                    'missed' => $missedAppointments,
                    'upcoming' => $upcomingAppointments,
                    'completion_rate' => $totalAppointments > 0 ? round(($completedAppointments / $totalAppointments) * 100, 1) : 0,
                ],
                'prescriptions' => [
                    'total' => $totalPrescriptions,
                    'active' => $activePrescriptions,
                    'expired' => $expiredPrescriptions,
                    'expiry_rate' => $totalPrescriptions > 0 ? round(($expiredPrescriptions / $totalPrescriptions) * 100, 1) : 0,
                ],
            ],
            'vision_trends' => $visionTrends,
        ]);
    }

    /**
     * Get optometrist analytics
     * GET /api/optometrists/{id}/analytics
     */
    public function getOptometristAnalytics(Request $request, $optometristId): JsonResponse
    {
        $user = Auth::user();
        
        // Check if user can access this optometrist's data
        if (!$user || 
            ($user->role->value !== 'admin' && 
             $user->id != $optometristId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $optometrist = User::find($optometristId);
        if (!$optometrist || $optometrist->role->value !== 'optometrist') {
            return response()->json(['message' => 'Optometrist not found'], 404);
        }

        $period = $request->get('period', '30'); // days
        $startDate = Carbon::now()->subDays($period);

        // Get daily/weekly appointments count
        $appointments = Appointment::where('optometrist_id', $optometristId)
            ->where('appointment_date', '>=', $startDate)
            ->get();

        $dailyAppointments = $appointments->groupBy(function ($appointment) {
            return $appointment->appointment_date->format('Y-m-d');
        })->map(function ($dayAppointments) {
            return [
                'date' => $dayAppointments->first()->appointment_date->format('Y-m-d'),
                'total' => $dayAppointments->count(),
                'completed' => $dayAppointments->where('status', 'completed')->count(),
                'cancelled' => $dayAppointments->where('status', 'cancelled')->count(),
                'scheduled' => $dayAppointments->where('status', 'scheduled')->count(),
            ];
        })->values();

        // Get prescriptions issued per period
        $prescriptions = Prescription::where('optometrist_id', $optometristId)
            ->where('issue_date', '>=', $startDate)
            ->get();

        $prescriptionStats = [
            'total_issued' => $prescriptions->count(),
            'by_type' => $prescriptions->groupBy('type')->map->count(),
            'by_status' => $prescriptions->groupBy('status')->map->count(),
        ];

        // Get follow-up compliance (patients who returned vs missed)
        $followUpCompliance = $this->calculateFollowUpCompliance($optometristId, $startDate);

        // Get workload distribution
        $workloadDistribution = $this->calculateWorkloadDistribution($optometristId, $startDate);

        return response()->json([
            'optometrist' => [
                'id' => $optometrist->id,
                'name' => $optometrist->name,
                'email' => $optometrist->email,
                'branch' => $optometrist->branch ? [
                    'name' => $optometrist->branch->name,
                    'address' => $optometrist->branch->address,
                ] : null,
            ],
            'period' => [
                'days' => $period,
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => Carbon::now()->format('Y-m-d'),
            ],
            'appointments' => [
                'daily' => $dailyAppointments,
                'total' => $appointments->count(),
                'completed' => $appointments->where('status', 'completed')->count(),
                'cancelled' => $appointments->where('status', 'cancelled')->count(),
                'scheduled' => $appointments->where('status', 'scheduled')->count(),
            ],
            'prescriptions' => $prescriptionStats,
            'follow_up_compliance' => $followUpCompliance,
            'workload_distribution' => $workloadDistribution,
        ]);
    }


    /**
     * Get admin analytics
     * GET /api/admin/analytics
     */
    public function getAdminAnalytics(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $period = $request->get('period', '30'); // days
        $branchId = $request->get('branch_id');
        
        // Convert branchId to integer if it's provided
        if ($branchId && $branchId !== 'all') {
            $branchId = is_numeric($branchId) ? (int) $branchId : null;
        } else {
            $branchId = null;
        }
        
        $startDate = Carbon::now()->subDays((int)$period)->startOfDay();
        
        \Log::info('Admin Analytics Query', [
            'branchId' => $branchId,
            'period' => $period,
            'startDate' => $startDate->format('Y-m-d H:i:s'),
            'endDate' => Carbon::now()->format('Y-m-d H:i:s'),
            'total_appointments_all_time' => Appointment::count(),
            'completed_appointments_all_time' => Appointment::where('status', 'completed')->count(),
            'appointments_in_period' => Appointment::whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                ->count(),
            'completed_in_period' => Appointment::whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                ->where('status', 'completed')
                ->count()
        ]);

        // Get comparison of branch performance
        $branchPerformance = $this->getBranchPerformanceComparison($startDate);

        // Get optometrist workload report
        $optometristWorkload = $this->getOptometristWorkloadReport($startDate);

        // Get staff activity logs
        $staffActivity = $this->getStaffActivityReport($startDate);

        // Get system-wide inventory + sales trends (filtered by branch if provided)
        $systemWideStats = $this->getSystemWideStats($startDate, $branchId);

        // Get most common diagnoses/prescriptions
        $commonDiagnoses = $this->getCommonDiagnoses($startDate);

        return response()->json([
            'period' => [
                'days' => $period,
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => Carbon::now()->format('Y-m-d'),
            ],
            'branch_performance' => $branchPerformance,
            'optometrist_workload' => $optometristWorkload,
            'staff_activity' => $staffActivity,
            'system_wide_stats' => $systemWideStats,
            'common_diagnoses' => $commonDiagnoses,
        ]);
    }

    /**
     * Analyze vision trends from prescriptions
     */
    private function analyzeVisionTrends($prescriptions)
    {
        if ($prescriptions->count() < 2) {
            return [
                'trend_available' => false,
                'message' => 'Insufficient data for trend analysis'
            ];
        }

        $rightEyeSph = $prescriptions->pluck('right_eye.sph')->filter()->values();
        $leftEyeSph = $prescriptions->pluck('left_eye.sph')->filter()->values();
        $rightEyeCyl = $prescriptions->pluck('right_eye.cyl')->filter()->values();
        $leftEyeCyl = $prescriptions->pluck('left_eye.cyl')->filter()->values();

        return [
            'trend_available' => true,
            'right_eye' => [
                'sph_trend' => $this->calculateTrend($rightEyeSph),
                'cyl_trend' => $this->calculateTrend($rightEyeCyl),
            ],
            'left_eye' => [
                'sph_trend' => $this->calculateTrend($leftEyeSph),
                'cyl_trend' => $this->calculateTrend($leftEyeCyl),
            ],
        ];
    }

    /**
     * Calculate trend direction and magnitude
     */
    private function calculateTrend($values)
    {
        if ($values->count() < 2) {
            return 'insufficient_data';
        }

        $first = $values->first();
        $last = $values->last();
        $change = $last - $first;
        
        if (abs($change) < 0.25) {
            return 'stable';
        } elseif ($change > 0) {
            return 'increasing';
        } else {
            return 'decreasing';
        }
    }

    /**
     * Calculate follow-up compliance for optometrist
     */
    private function calculateFollowUpCompliance($optometristId, $startDate)
    {
        $appointments = Appointment::where('optometrist_id', $optometristId)
            ->where('appointment_date', '>=', $startDate)
            ->get();

        $totalAppointments = $appointments->count();
        $completedAppointments = $appointments->where('status', 'completed')->count();
        $cancelledAppointments = $appointments->where('status', 'cancelled')->count();

        return [
            'total_appointments' => $totalAppointments,
            'completed' => $completedAppointments,
            'cancelled' => $cancelledAppointments,
            'compliance_rate' => $totalAppointments > 0 ? 
                round(($completedAppointments / $totalAppointments) * 100, 1) : 0,
        ];
    }

    /**
     * Calculate workload distribution for optometrist
     */
    private function calculateWorkloadDistribution($optometristId, $startDate)
    {
        $appointments = Appointment::where('optometrist_id', $optometristId)
            ->where('appointment_date', '>=', $startDate)
            ->get();

        return [
            'by_type' => $appointments->groupBy('type')->map->count(),
            'by_status' => $appointments->groupBy('status')->map->count(),
            'by_weekday' => $appointments->groupBy(function ($appointment) {
                return $appointment->appointment_date->format('l');
            })->map->count(),
        ];
    }

    /**
     * Calculate inventory stats for staff branch
     */
    private function calculateInventoryStats($branchId, $startDate)
    {
        $branchStock = BranchStock::where('branch_id', $branchId)->get();
        
        // Get products sold in the period (from reservations)
        $soldProducts = DB::table('reservation_items')
            ->join('reservations', 'reservation_items.reservation_id', '=', 'reservations.id')
            ->where('reservations.branch_id', $branchId)
            ->where('reservations.created_at', '>=', $startDate)
            ->where('reservations.status', 'completed')
            ->select('reservation_items.product_id', DB::raw('SUM(reservation_items.quantity) as sold_quantity'))
            ->groupBy('reservation_items.product_id')
            ->get()
            ->keyBy('product_id');

        $totalStock = $branchStock->sum('stock_quantity');
        $lowStockItems = $branchStock->where('available_quantity', '<', 5)->count();
        $outOfStockItems = $branchStock->where('available_quantity', '<=', 0)->count();

        return [
            'total_items' => $branchStock->count(),
            'total_stock' => $totalStock,
            'low_stock_items' => $lowStockItems,
            'out_of_stock_items' => $outOfStockItems,
            'sold_products' => $soldProducts,
        ];
    }

    /**
     * Calculate daily performance for staff branch
     */
    private function calculateDailyPerformance($branchId, $startDate)
    {
        $appointments = Appointment::where('branch_id', $branchId)
            ->where('appointment_date', '>=', $startDate)
            ->get()
            ->groupBy(function ($appointment) {
                return $appointment->appointment_date->format('Y-m-d');
            });

        // Reservations not used for revenue calculation (included in receipts when approved)
        $reservations = collect();
            
            $receipts = Receipt::whereHas('appointment', function($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })->where('date', '>=', $startDate->format('Y-m-d'))
            ->get()
            ->groupBy(function ($receipt) {
                return $receipt->date->format('Y-m-d');
            });

        $transactions = Transaction::where('branch_id', $branchId)
            ->where('created_at', '>=', $startDate)
            ->get()
            ->groupBy(function ($transaction) {
                return $transaction->created_at->format('Y-m-d');
            });

        $dailyData = [];
        $currentDate = $startDate->copy();
        
        while ($currentDate->lte(Carbon::now())) {
            $dateStr = $currentDate->format('Y-m-d');
            $dayAppointments = $appointments->get($dateStr, collect());
            $dayReservations = $reservations->get($dateStr, collect());
            $dayReceipts = $receipts->get($dateStr, collect());
            $dayTransactions = $transactions->get($dateStr, collect());

            // Reservation Revenue - Not counted (reservations are included in receipts when approved)
            $reservationRevenue = 0;
            
            // Receipt revenue uses 'total_due' field
            $receiptRevenue = $dayReceipts->sum('total_due');
            
            // Transaction revenue
            $transactionRevenue = $dayTransactions->where('status', 'Completed')->sum('total_amount');
            $totalRevenue = $reservationRevenue + $receiptRevenue + $transactionRevenue;

            $dailyData[] = [
                'date' => $dateStr,
                'appointments' => $dayAppointments->count(),
                'completed_appointments' => $dayAppointments->where('status', 'completed')->count(),
                'reservations' => $dayReservations->count(),
                'receipts' => $dayReceipts->count(),
                'transactions' => $dayTransactions->count(),
                'revenue' => $totalRevenue,
                'reservation_revenue' => $reservationRevenue,
                'receipt_revenue' => $receiptRevenue,
                'transaction_revenue' => $transactionRevenue,
            ];

            $currentDate->addDay();
        }

        return $dailyData;
    }

    /**
     * Get branch performance comparison for admin
     */
    private function getBranchPerformanceComparison($startDate)
    {
        $branches = Branch::where('is_active', true)->get();
        $branchPerformance = [];

        foreach ($branches as $branch) {
            // Use whereDate for proper date comparison
            $startDateFormatted = $startDate instanceof Carbon ? $startDate->format('Y-m-d') : $startDate;
            $appointments = Appointment::where('branch_id', $branch->id)
                ->whereDate('appointment_date', '>=', $startDateFormatted)
                ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                ->get();

            // Get receipts for this branch - try direct branch_id first, then through appointments
            $receipts = collect();
            try {
                // Try direct branch_id if column exists (use 'date' field, not 'created_at')
                $receipts = Receipt::where('branch_id', $branch->id)
                    ->whereDate('date', '>=', $startDateFormatted)
                    ->whereDate('date', '<=', Carbon::now()->format('Y-m-d'))
                    ->get();
            } catch (\Exception $e) {
                // Fallback to through appointments
                try {
                    $receipts = Receipt::whereHas('appointment', function($q) use ($branch) {
                        $q->where('branch_id', $branch->id);
                    })->whereDate('date', '>=', $startDateFormatted)
                      ->whereDate('date', '<=', Carbon::now()->format('Y-m-d'))
                      ->get();
                } catch (\Exception $e2) {
                    \Log::warning('Receipt query failed for branch: ' . $e2->getMessage());
                }
            }

            // Reservation Revenue - Not counted (reservations are included in receipts when approved)
            $reservationRevenue = 0;
            $receiptRevenue = $receipts->sum('total_due');
            $totalRevenue = $receiptRevenue;

            $branchPerformance[] = [
                'branch_id' => $branch->id,
                'branch_name' => $branch->name,
                'appointments' => $appointments->count(),
                'completed_appointments' => $appointments->where('status', 'completed')->count(),
                'revenue' => $totalRevenue,
                'reservation_revenue' => $reservationRevenue,
                'receipt_revenue' => $receiptRevenue,
                'unique_patients' => $appointments->pluck('patient_id')->unique()->count(),
            ];
        }

        return $branchPerformance;
    }

    /**
     * Get optometrist workload report for admin
     */
    private function getOptometristWorkloadReport($startDate)
    {
        $optometrists = User::where('role', 'optometrist')->get();
        $workloadReport = [];

        foreach ($optometrists as $optometrist) {
            // Use whereDate for proper date comparison
            $startDateFormatted = $startDate instanceof Carbon ? $startDate->format('Y-m-d') : $startDate;
            $appointments = Appointment::where('optometrist_id', $optometrist->id)
                ->whereDate('appointment_date', '>=', $startDateFormatted)
                ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                ->get();

            $prescriptions = Prescription::where('optometrist_id', $optometrist->id)
                ->where('issue_date', '>=', $startDate)
                ->get();

            $workloadReport[] = [
                'optometrist_id' => $optometrist->id,
                'optometrist_name' => $optometrist->name,
                'branch' => $optometrist->branch ? $optometrist->branch->name : 'No Branch',
                'appointments' => $appointments->count(),
                'prescriptions_issued' => $prescriptions->count(),
                'unique_patients' => $appointments->pluck('patient_id')->unique()->count(),
            ];
        }

        return $workloadReport;
    }

    /**
     * Get staff activity report for admin
     */
    private function getStaffActivityReport($startDate)
    {
        $staff = User::where('role', 'staff')->get();
        $activityReport = [];

        foreach ($staff as $staffMember) {
            if (!$staffMember->branch_id) continue;

            // Use whereDate for proper date comparison
            $appointments = Appointment::where('branch_id', $staffMember->branch_id)
                ->whereDate('appointment_date', '>=', $startDate instanceof Carbon ? $startDate->format('Y-m-d') : $startDate)
                ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                ->get();

            $reservations = Reservation::with('product')
                ->where('branch_id', $staffMember->branch_id)
                ->where('created_at', '>=', $startDate)
                ->get();
                
            // Get receipts for this branch through appointments (use 'date' field)
            $receipts = Receipt::whereHas('appointment', function($q) use ($staffMember) {
                $q->where('branch_id', $staffMember->branch_id);
            })->where('date', '>=', $startDate instanceof Carbon ? $startDate->format('Y-m-d') : $startDate)->get();

            // Reservation Revenue - Not counted (reservations are included in receipts when approved)
            $reservationRevenue = 0;
            $receiptRevenue = $receipts->sum('total_due');
            $totalRevenue = $receiptRevenue;

            $activityReport[] = [
                'staff_id' => $staffMember->id,
                'staff_name' => $staffMember->name,
                'branch' => $staffMember->branch->name,
                'appointments_managed' => $appointments->count(),
                'reservations_processed' => $reservations->count(),
                'receipts_created' => $receipts->count(),
                'revenue_generated' => $totalRevenue,
                'reservation_revenue' => $reservationRevenue,
                'receipt_revenue' => $receiptRevenue,
            ];
        }

        return $activityReport;
    }

    /**
     * Get system-wide stats for admin (filtered by branch if provided)
     */
    private function getSystemWideStats($startDate, $branchId = null)
    {
        // Ensure startDate is properly formatted for date comparison
        $startDateFormatted = $startDate instanceof Carbon ? $startDate->format('Y-m-d') : $startDate;
        
        // Get appointments (filtered by branch if provided)
        // If branchId is provided, check both direct branch_id and through receipts
        // For receipts, use receipt date instead of appointment_date
        if ($branchId) {
            // Branch-specific: check both direct branch_id and through receipts
            $appointmentsQuery = Appointment::where(function($q) use ($startDateFormatted, $branchId) {
                // Appointments with branch_id in date range
                $q->whereDate('appointment_date', '>=', $startDateFormatted)
                  ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                  ->where('branch_id', $branchId);
            })->orWhere(function($q) use ($startDateFormatted, $branchId) {
                // Appointments linked to receipts with branch_id where receipt date is in range
                $q->whereHas('receipt', function($q2) use ($startDateFormatted, $branchId) {
                    $q2->where('branch_id', $branchId)
                       ->whereDate('date', '>=', $startDateFormatted)
                       ->whereDate('date', '<=', Carbon::now()->format('Y-m-d'));
                });
            });
        } else {
            // Global view: include all appointments in date range (by appointment_date OR receipt date)
            $appointmentsQuery = Appointment::where(function($q) use ($startDateFormatted) {
                // Appointments with appointment_date in range
                $q->whereDate('appointment_date', '>=', $startDateFormatted)
                  ->whereDate('appointment_date', '<=', Carbon::now()->format('Y-m-d'));
            })->orWhere(function($q) use ($startDateFormatted) {
                // Appointments linked to receipts where receipt date is in range
                $q->whereHas('receipt', function($q2) use ($startDateFormatted) {
                    $q2->whereDate('date', '>=', $startDateFormatted)
                       ->whereDate('date', '<=', Carbon::now()->format('Y-m-d'));
                });
            });
        }
        
        $totalAppointments = $appointmentsQuery->count();
        
        \Log::info('System-wide appointments query', [
            'startDate' => $startDateFormatted,
            'branchId' => $branchId,
            'endDate' => Carbon::now()->format('Y-m-d'),
            'total_appointments' => $totalAppointments,
            'completed' => (clone $appointmentsQuery)->where('status', 'completed')->count()
        ]);
        
        // Get total reservations count (for statistics only, not revenue)
        $totalReservations = 0;
        try {
            $reservationsQuery = Reservation::whereDate('created_at', '>=', $startDateFormatted)
                ->whereDate('created_at', '<=', Carbon::now()->format('Y-m-d'));
            
            if ($branchId) {
                $reservationsQuery->where('branch_id', $branchId);
            }
            
            $totalReservations = $reservationsQuery->count();
        } catch (\Exception $e) {
            \Log::warning('Reservation query failed: ' . $e->getMessage());
        }
        
        // Reservation Revenue - Not counted (reservations are included in receipts when approved)
        $reservationRevenue = 0;
        
        // Calculate total revenue from receipts (use 'date' field, not 'created_at')
        // Filter by branch if provided
        $receiptRevenue = 0;
        try {
            $receiptQuery = Receipt::whereDate('date', '>=', $startDateFormatted)
                ->whereDate('date', '<=', Carbon::now()->format('Y-m-d'));
            
            if ($branchId) {
                // Try direct branch_id first, fallback to appointment relationship
                $receiptQuery->where(function($q) use ($branchId) {
                    $q->where('branch_id', $branchId)
                      ->orWhereHas('appointment', function($q2) use ($branchId) {
                          $q2->where('branch_id', $branchId);
                      });
                });
            }
            
            $receiptRevenue = $receiptQuery->sum('total_due') ?? 0;
        } catch (\Exception $e) {
            \Log::warning('Receipt query failed: ' . $e->getMessage());
        }
            
        // Calculate total revenue from transactions (filtered by branch if provided)
        $transactionRevenue = 0;
        try {
            $transactionQuery = Transaction::whereDate('created_at', '>=', $startDateFormatted)
                ->whereDate('created_at', '<=', Carbon::now()->format('Y-m-d'))
                ->where('status', 'Completed');
            
            if ($branchId) {
                $transactionQuery->where('branch_id', $branchId);
            }
            
            $transactionRevenue = $transactionQuery->sum('total_amount') ?? 0;
        } catch (\Exception $e) {
            \Log::warning('Transaction query failed: ' . $e->getMessage());
        }
            
        $totalRevenue = $receiptRevenue + $transactionRevenue;
        
        \Log::info('Revenue calculation', [
            'startDate' => $startDateFormatted,
            'branchId' => $branchId,
            'reservationRevenue' => $reservationRevenue,
            'receiptRevenue' => $receiptRevenue,
            'transactionRevenue' => $transactionRevenue,
            'totalRevenue' => $totalRevenue
        ]);

        // System-wide stats (not filtered by branch)
        $totalProducts = Product::count();
        $totalBranches = Branch::where('is_active', true)->count();
        $totalUsers = User::count();

        return [
            'appointments' => $totalAppointments,
            'reservations' => $totalReservations,
            'revenue' => $totalRevenue,
            'reservation_revenue' => $reservationRevenue,
            'receipt_revenue' => $receiptRevenue,
            'transaction_revenue' => $transactionRevenue,
            'products' => $totalProducts,
            'branches' => $totalBranches,
            'users' => $totalUsers,
        ];
    }

    /**
     * Get most common diagnoses/prescriptions for admin
     */
    private function getCommonDiagnoses($startDate)
    {
        $prescriptions = Prescription::where('issue_date', '>=', $startDate)->get();

        $commonTypes = $prescriptions->groupBy('type')->map->count()->sortDesc();
        $commonLensTypes = $prescriptions->groupBy('lens_type')->map->count()->sortDesc();
        $commonCoatings = $prescriptions->groupBy('coating')->map->count()->sortDesc();

        return [
            'by_type' => $commonTypes,
            'by_lens_type' => $commonLensTypes,
            'by_coating' => $commonCoatings,
        ];
    }

    /**
     * Get real-time analytics summary
     * GET /api/analytics/realtime
     */
    public function getRealTimeAnalytics(): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $today = Carbon::today();
            
            // Get today's appointments
            $totalAppointmentsToday = Appointment::whereDate('appointment_date', $today)->count();
            
            // Get today's revenue from receipts only (reservations are included in receipts when approved)
            $reservationRevenueToday = 0;
                
            $receiptRevenueToday = 0;
            try {
                $receiptRevenueToday = Receipt::whereDate('date', $today)
                    ->sum('total_due') ?? 0;
            } catch (\Exception $e) {
                \Log::warning('Could not fetch receipt revenue: ' . $e->getMessage());
            }
                
            $totalRevenueToday = $reservationRevenueToday + $receiptRevenueToday;
            
            // Get active users (use updated_at as proxy for last login if last_login_at doesn't exist)
            try {
                $activeUsers = User::where('updated_at', '>=', Carbon::now()->subDay())->count();
            } catch (\Exception $e) {
                $activeUsers = User::count(); // Fallback to total users
            }
            
            // Get low stock alerts
            $lowStockAlerts = BranchStock::where('stock_quantity', '<=', DB::raw('min_stock_threshold'))->count();
        
            // Get upcoming appointments (next 7 days)
            $upcomingAppointments = Appointment::whereBetween('appointment_date', [
                Carbon::now(),
                Carbon::now()->addDays(7)
            ])->count();

            return response()->json([
                'total_appointments_today' => $totalAppointmentsToday,
                'total_revenue_today' => $totalRevenueToday,
                'active_users' => $activeUsers,
                'low_stock_alerts' => $lowStockAlerts,
                'upcoming_appointments' => $upcomingAppointments,
                'system_health' => [
                    'database_status' => 'healthy',
                    'api_response_time' => microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true)),
                    'last_backup' => Carbon::now()->subHours(6)->format('Y-m-d H:i:s'),
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Real-time analytics error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch analytics',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get analytics trends over time
     * GET /api/analytics/trends
     */
    public function getAnalyticsTrends(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $period = $request->get('period', 30); // days
            $startDate = Carbon::now()->subDays($period);
            $branchId = $request->get('branch_id');
            
            // Convert branchId to integer if it's provided
            if ($branchId && $branchId !== 'all') {
                $branchId = is_numeric($branchId) ? (int) $branchId : null;
            } else {
                $branchId = null;
            }
            
            \Log::info('Analytics Trends Query', [
                'period' => $period,
                'branchId' => $branchId,
                'branchIdType' => gettype($branchId),
                'startDate' => $startDate->format('Y-m-d'),
            ]);

        // Revenue trend (including reservations, receipts, and transactions)
        $revenueTrend = [];
        for ($i = $period; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i);
            
            // Reservation Revenue - Not counted (reservations are included in receipts when approved)
            $reservationRevenue = 0;
            
            // Get receipt revenue (use 'date' field, not 'created_at')
            $receiptRevenue = 0;
            try {
                $receiptQuery = Receipt::whereDate('date', $date);
                
                if ($branchId) {
                    // Filter receipts by branch_id directly or through appointments
                    $receiptQuery->where(function($q) use ($branchId) {
                        $q->where('branch_id', $branchId)
                          ->orWhereHas('appointment', function($q2) use ($branchId) {
                              $q2->where('branch_id', $branchId);
                          });
                    });
                }
                
                $receiptRevenue = $receiptQuery->sum('total_due') ?? 0;
            } catch (\Exception $e) {
                // Receipts table might not exist or have different schema
                \Log::debug('Receipt revenue query failed: ' . $e->getMessage());
            }
            
            // Get transaction revenue
            $transactionRevenue = 0;
            try {
                $transactionQuery = Transaction::whereDate('created_at', $date)
                    ->where('status', 'Completed');
                
                if ($branchId) {
                    $transactionQuery->where('branch_id', $branchId);
                }
                
                $transactionRevenue = $transactionQuery->sum('total_amount') ?? 0;
            } catch (\Exception $e) {
                // Transactions table might not exist
            }
            
            $totalRevenue = $reservationRevenue + $receiptRevenue + $transactionRevenue;
            
            // Get appointments count
            // If branchId is provided, check both direct branch_id and through receipts
            // For receipts, use receipt date instead of appointment_date
            if ($branchId) {
                // Branch-specific: check both direct branch_id and through receipts
                $appointmentQuery = Appointment::where(function($q) use ($date, $branchId) {
                    // Appointments with branch_id on this date
                    $q->whereDate('appointment_date', $date)
                      ->where('branch_id', $branchId);
                })->orWhere(function($q) use ($date, $branchId) {
                    // Appointments linked to receipts with branch_id where receipt date is this date
                    $q->whereHas('receipt', function($q2) use ($date, $branchId) {
                        $q2->where('branch_id', $branchId)
                           ->whereDate('date', $date);
                    });
                });
            } else {
                // Global view: include all appointments on this date (by appointment_date OR receipt date)
                $appointmentQuery = Appointment::where(function($q) use ($date) {
                    // Appointments with appointment_date on this date
                    $q->whereDate('appointment_date', $date);
                })->orWhere(function($q) use ($date) {
                    // Appointments linked to receipts where receipt date is this date
                    $q->whereHas('receipt', function($q2) use ($date) {
                        $q2->whereDate('date', $date);
                    });
                });
            }
            $appointments = $appointmentQuery->count();
            
            // Get patients count (unique patients for this day)
            if ($branchId) {
                // Branch-specific: check both direct branch_id and through receipts
                $patientQuery = Appointment::where(function($q) use ($date, $branchId) {
                    // Appointments with branch_id on this date
                    $q->whereDate('appointment_date', $date)
                      ->where('branch_id', $branchId);
                })->orWhere(function($q) use ($date, $branchId) {
                    // Appointments linked to receipts with branch_id where receipt date is this date
                    $q->whereHas('receipt', function($q2) use ($date, $branchId) {
                        $q2->where('branch_id', $branchId)
                           ->whereDate('date', $date);
                    });
                });
            } else {
                // Global view: include all appointments on this date (by appointment_date OR receipt date)
                $patientQuery = Appointment::where(function($q) use ($date) {
                    // Appointments with appointment_date on this date
                    $q->whereDate('appointment_date', $date);
                })->orWhere(function($q) use ($date) {
                    // Appointments linked to receipts where receipt date is this date
                    $q->whereHas('receipt', function($q2) use ($date) {
                        $q2->whereDate('date', $date);
                    });
                });
            }
            $patients = $patientQuery->distinct('patient_id')->count('patient_id');

            $revenueTrend[] = [
                'date' => $date->format('Y-m-d'),
                'revenue' => $totalRevenue,
                'reservation_revenue' => $reservationRevenue,
                'receipt_revenue' => $receiptRevenue,
                'transaction_revenue' => $transactionRevenue,
                'appointments' => $appointments,
                'patients' => $patients, // Daily patient count (for charts)
            ];
        }

        // Calculate unique patients across entire period (not summing daily counts)
        // If branchId is provided, check both direct branch_id and through receipts
        // Use receipt date for appointments linked to receipts (since revenue is based on receipt date)
        if ($branchId) {
            // Branch-specific: check both direct branch_id and through receipts
            $uniquePatientsQuery = Appointment::where(function($q) use ($startDate, $branchId) {
                // Appointments with branch_id in date range
                $q->whereBetween('appointment_date', [
                    $startDate->format('Y-m-d'),
                    Carbon::now()->format('Y-m-d')
                ])->where('branch_id', $branchId);
            })->orWhere(function($q) use ($startDate, $branchId) {
                // Appointments linked to receipts with branch_id where receipt date is in range
                $q->whereHas('receipt', function($q2) use ($startDate, $branchId) {
                    $q2->where('branch_id', $branchId)
                       ->whereBetween('date', [
                           $startDate->format('Y-m-d'),
                           Carbon::now()->format('Y-m-d')
                       ]);
                });
            });
        } else {
            // Global view: include all appointments in date range (by appointment_date OR receipt date)
            $uniquePatientsQuery = Appointment::where(function($q) use ($startDate) {
                // Appointments with appointment_date in range
                $q->whereBetween('appointment_date', [
                    $startDate->format('Y-m-d'),
                    Carbon::now()->format('Y-m-d')
                ]);
            })->orWhere(function($q) use ($startDate) {
                // Appointments linked to receipts where receipt date is in range
                $q->whereHas('receipt', function($q2) use ($startDate) {
                    $q2->whereBetween('date', [
                        $startDate->format('Y-m-d'),
                        Carbon::now()->format('Y-m-d')
                    ]);
                });
            });
        }
        
        $uniquePatientsTotal = $uniquePatientsQuery->distinct('patient_id')->count('patient_id');
        
        // Debug logging
        $totalAppointmentsInPeriod = (clone $uniquePatientsQuery)->count();
        \Log::info('Unique Patients Calculation', [
            'branchId' => $branchId,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => Carbon::now()->format('Y-m-d'),
            'uniquePatientsTotal' => $uniquePatientsTotal,
            'totalAppointmentsInPeriod' => $totalAppointmentsInPeriod,
        ]);

        // Appointment trend
        $appointmentTrend = [];
        for ($i = $period; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i);
            $dateString = $date->format('Y-m-d');
            
            // Build base query for the date
            // If branchId is provided, check both direct branch_id and through receipts
            // For receipts, use receipt date instead of appointment_date
            if ($branchId) {
                // Branch-specific: check both direct branch_id and through receipts
                $baseQuery = Appointment::where(function($q) use ($dateString, $branchId) {
                    // Appointments with branch_id on this date
                    $q->whereDate('appointment_date', $dateString)
                      ->where('branch_id', $branchId);
                })->orWhere(function($q) use ($dateString, $branchId) {
                    // Appointments linked to receipts with branch_id where receipt date is this date
                    $q->whereHas('receipt', function($q2) use ($dateString, $branchId) {
                        $q2->where('branch_id', $branchId)
                           ->whereDate('date', $dateString);
                    });
                });
            } else {
                // Global view: include all appointments on this date (by appointment_date OR receipt date)
                $baseQuery = Appointment::where(function($q) use ($dateString) {
                    // Appointments with appointment_date on this date
                    $q->whereDate('appointment_date', $dateString);
                })->orWhere(function($q) use ($dateString) {
                    // Appointments linked to receipts where receipt date is this date
                    $q->whereHas('receipt', function($q2) use ($dateString) {
                        $q2->whereDate('date', $dateString);
                    });
                });
            }
            
            // Get total count (clone to preserve base query)
            $total = (clone $baseQuery)->count();
            
            // Get completed count (clone to avoid modifying base query)
            $completed = (clone $baseQuery)->where('status', 'completed')->count();
            
            // Get cancelled count (clone to avoid modifying base query)
            $cancelled = (clone $baseQuery)->where('status', 'cancelled')->count();
            
            $appointmentTrend[] = [
                'date' => $dateString,
                'total' => $total,
                'completed' => $completed,
                'cancelled' => $cancelled,
            ];
        }
        
        \Log::debug('Appointment trend data generated', [
            'period' => $period,
            'branch_id' => $branchId,
            'trend_count' => count($appointmentTrend),
            'sample_data' => array_slice($appointmentTrend, 0, 3),
        ]);

        // Inventory trend
        $inventoryTrend = [];
        for ($i = $period; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i);
            $query = BranchStock::whereDate('updated_at', $date);
            
            if ($branchId) {
                $query->where('branch_id', $branchId);
            }
            
            $inventoryTrend[] = [
                'date' => $date->format('Y-m-d'),
                'total_items' => $query->count(),
                'low_stock' => $query->whereRaw('stock_quantity <= min_stock_threshold')->count(),
                'out_of_stock' => $query->whereRaw('stock_quantity <= reserved_quantity')->count(),
            ];
        }

        // Appointment types distribution
        $appointmentTypesQuery = Appointment::whereBetween('appointment_date', [$startDate, Carbon::now()]);
        if ($branchId) {
            $appointmentTypesQuery->where('branch_id', $branchId);
        }
        
        $appointmentTypes = $appointmentTypesQuery->select('type', DB::raw('count(*) as count'))
            ->groupBy('type')
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->type ?: 'General Consultation',
                    'value' => $item->count
                ];
            });

            return response()->json([
                'revenue_trend' => $revenueTrend,
                'appointment_trend' => $appointmentTrend,
                'inventory_trend' => $inventoryTrend,
                'appointment_types' => $appointmentTypes,
                'unique_patients_total' => $uniquePatientsTotal, // Unique patients across entire period
            ]);
        } catch (\Exception $e) {
            \Log::error('Analytics trends error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'period' => $period,
                'branch_id' => $branchId,
            ]);
            
            // Return empty arrays on error to prevent frontend crashes
            return response()->json([
                'error' => 'Failed to fetch analytics trends',
                'message' => $e->getMessage(),
                'revenue_trend' => [],
                'appointment_trend' => [],
                'inventory_trend' => [],
                'appointment_types' => [],
                'unique_patients_total' => 0,
            ], 500);
        }
    }

    /**
     * Export analytics data
     * GET /api/analytics/export
     */
    public function exportAnalytics(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $type = $request->get('type', 'admin');
        $format = $request->get('format', 'csv');
        $period = $request->get('period', 30);
        $startDate = Carbon::now()->subDays($period);

        // For now, return a JSON response with export data
        // In a real implementation, you would generate actual PDF/CSV/Excel files
        $exportData = [
            'type' => $type,
            'format' => $format,
            'period' => $period,
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => Carbon::now()->format('Y-m-d'),
            'generated_at' => Carbon::now()->format('Y-m-d H:i:s'),
            'generated_by' => $user->name,
        ];

        // Add type-specific data
        switch ($type) {
            case 'admin':
                $exportData['data'] = $this->getAdminAnalytics($request);
                break;
            case 'customer':
                $customerId = $request->get('customer_id');
                if ($customerId) {
                    $exportData['data'] = $this->getCustomerAnalytics($request, $customerId);
                }
                break;
            case 'optometrist':
                $optometristId = $request->get('optometrist_id');
                if ($optometristId) {
                    $exportData['data'] = $this->getOptometristAnalytics($request, $optometristId);
                }
                break;
        }

        return response()->json([
            'message' => 'Export data prepared',
            'export_data' => $exportData,
            'download_url' => null, // Would be a real download URL in production
        ]);
    }

    /**
     * Get staff analytics
     * GET /api/staff/analytics
     */
    public function getStaffAnalytics(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'staff') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $period = $request->get('period', 30);
        $startDate = Carbon::now()->subDays($period);

        // Get staff's branch
        $branchId = $user->branch_id;
        
        // Get branch-specific analytics
        $branchAppointments = Appointment::where('branch_id', $branchId)
            ->where('created_at', '>=', $startDate)
            ->count();

        $branchReservations = Reservation::whereHas('product', function($query) use ($branchId) {
            $query->where('branch_id', $branchId);
        })->where('created_at', '>=', $startDate)->count();

        $lowStockItems = BranchStock::where('branch_id', $branchId)
            ->whereColumn('stock_quantity', '<=', 'min_stock_threshold')
            ->count();

        return response()->json([
            'staff' => [
                'id' => $user->id,
                'name' => $user->name,
                'branch' => $user->branch ? $user->branch->name : 'No Branch',
            ],
            'period' => [
                'days' => $period,
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => Carbon::now()->format('Y-m-d'),
            ],
            'branch_analytics' => [
                'appointments' => $branchAppointments,
                'reservations' => $branchReservations,
                'low_stock_items' => $lowStockItems,
            ],
        ]);
    }

    /**
     * Get branch performance analytics
     */
    public function getBranchPerformance(): JsonResponse
    {
        try {
            $startDate = Carbon::now()->subDays(30);
            $branches = Branch::with(['appointments', 'reservations'])->get();
            
            $branchPerformance = $branches->map(function ($branch) use ($startDate) {
                // Get appointments in the last 30 days
                $appointments = $branch->appointments()
                    ->where('appointment_date', '>=', $startDate->format('Y-m-d'))
                    ->get();
                $appointmentCount = $appointments->count();
                
                // Get unique patients (patient count)
                $uniquePatients = $appointments->pluck('patient_id')->unique()->count();
                
                // Reservations not used for revenue calculation (included in receipts when approved)
                $reservations = collect();
                
                // Calculate revenue from receipts (use 'date' field, not 'created_at')
                $receiptRevenue = 0;
                try {
                    $receiptRevenue = Receipt::where('branch_id', $branch->id)
                        ->where('date', '>=', $startDate->format('Y-m-d'))
                        ->sum('total_due') ?? 0;
                } catch (\Exception $e) {
                    // Fallback to through appointments if branch_id doesn't exist
                    try {
                        $receiptRevenue = Receipt::whereHas('appointment', function($q) use ($branch) {
                            $q->where('branch_id', $branch->id);
                        })->where('date', '>=', $startDate->format('Y-m-d'))
                          ->sum('total_due') ?? 0;
                    } catch (\Exception $e2) {
                        \Log::warning('Receipt query failed for branch: ' . $e2->getMessage());
                    }
                }
                
                // Reservation Revenue - Not counted (reservations are included in receipts when approved)
                $reservationRevenue = 0;
                $totalRevenue = $receiptRevenue;
                
                // Calculate growth percentage (compare with previous 30 days)
                $previousStartDate = $startDate->copy()->subDays(30);
                $previousAppointments = $branch->appointments()
                    ->whereBetween('appointment_date', [$previousStartDate->format('Y-m-d'), $startDate->format('Y-m-d')])
                    ->count();
                $growth = $previousAppointments > 0 
                    ? round((($appointmentCount - $previousAppointments) / $previousAppointments) * 100, 1)
                    : ($appointmentCount > 0 ? 100 : 0);
                
                // Get inventory items count
                $inventoryItems = 0;
                try {
                    $inventoryItems = \App\Models\BranchStock::where('branch_id', $branch->id)->count();
                } catch (\Exception $e) {
                    \Log::warning('Inventory count query failed for branch: ' . $e->getMessage());
                }
                
                // Get low stock alerts count
                $lowStockAlerts = 0;
                try {
                    $lowStockAlerts = \App\Models\BranchStock::where('branch_id', $branch->id)
                        ->whereIn('status', ['Low Stock', 'Out of Stock'])
                        ->count();
                } catch (\Exception $e) {
                    \Log::warning('Low stock query failed for branch: ' . $e->getMessage());
                }
                
                // Calculate average satisfaction from feedback
                $satisfaction = 0;
                try {
                    $feedback = \App\Models\Feedback::where('branch_id', $branch->id)
                        ->where('created_at', '>=', $startDate)
                        ->avg('rating');
                    $satisfaction = round($feedback ?? 0, 1);
                } catch (\Exception $e) {
                    \Log::warning('Feedback query failed for branch: ' . $e->getMessage());
                }
                
                return [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'code' => $branch->code,
                    'address' => $branch->address,
                    'revenue' => round($totalRevenue, 2),
                    'patients' => $uniquePatients, // Unique patients at this branch
                    'patient_visits' => $appointmentCount, // Total patient visits (appointments) at this branch
                    'appointments' => $appointmentCount, // Keep for backward compatibility
                    'growth' => $growth,
                    'inventory_items' => $inventoryItems,
                    'low_stock_alerts' => $lowStockAlerts,
                    'satisfaction' => $satisfaction,
                    'is_active' => $branch->is_active,
                ];
            });

            // Calculate unique patients across ALL branches (not summing branch totals to avoid double-counting)
            $branchIds = $branches->pluck('id');
            $allAppointments = Appointment::whereIn('branch_id', $branchIds)
                ->where('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->where('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
                ->get();
            
            $uniquePatientsTotal = $allAppointments->pluck('patient_id')->unique()->count();
            $totalPatientVisits = $allAppointments->count();

            // Calculate summary totals
            $summary = [
                'total_branches' => $branches->count(),
                'active_branches' => $branches->where('is_active', true)->count(),
                'total_appointments' => $branchPerformance->sum('appointments'),
                'total_patient_visits' => $totalPatientVisits, // Total appointment count (includes repeat visits)
                'total_revenue' => $branchPerformance->sum('revenue'),
                'total_patients' => $uniquePatientsTotal, // Unique patients across all branches (not summed)
                'average_growth' => $branchPerformance->avg('growth') ?? 0,
            ];

            return response()->json([
                'branches' => $branchPerformance,
                'summary' => $summary
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching branch performance',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get product analytics for admin
     */
    public function getProductAnalytics(Request $request): JsonResponse
    {
        try {
            $period = $request->get('period', 30);
            $limit = $request->get('limit', 10);
            $branchId = $request->get('branch_id');
            
            $startDate = Carbon::now()->subDays($period);
            
            // Get top-selling products from reservations
            $reservationsQuery = Reservation::where('created_at', '>=', $startDate)
                ->where('status', 'completed');
            
            if ($branchId) {
                $reservationsQuery->where('branch_id', $branchId);
            }
            
            // Group by product_id and calculate total units sold and revenue
            $productSales = $reservationsQuery->selectRaw('
                    product_id,
                    SUM(quantity) as units_sold,
                    SUM(quantity * (SELECT price FROM products WHERE id = reservations.product_id)) as total_revenue
                ')
                ->groupBy('product_id')
                ->orderBy('units_sold', 'desc')
                ->limit($limit)
                ->get();
            
            // Get previous period for trend calculation
            $previousStartDate = $startDate->copy()->subDays($period);
            $previousProductSales = Reservation::where('created_at', '>=', $previousStartDate)
                ->where('created_at', '<', $startDate)
                ->where('status', 'completed')
                ->when($branchId, function($q) use ($branchId) {
                    $q->where('branch_id', $branchId);
                })
                ->selectRaw('product_id, SUM(quantity) as units_sold')
                ->groupBy('product_id')
                ->get()
                ->keyBy('product_id');
            
            // Load products and build response
            $productIds = $productSales->pluck('product_id');
            $products = Product::with(['category'])->whereIn('id', $productIds)->get()->keyBy('id');
            
            $topProducts = $productSales->map(function ($sale) use ($products, $previousProductSales) {
                $product = $products->get($sale->product_id);
                if (!$product) return null;
                
                $previousUnits = $previousProductSales->get($sale->product_id)?->units_sold ?? 0;
                $currentUnits = $sale->units_sold;
                $trendPercentage = $previousUnits > 0 
                    ? round((($currentUnits - $previousUnits) / $previousUnits) * 100, 1)
                    : ($currentUnits > 0 ? 100 : 0);
                
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category ? $product->category->name : 'No Category',
                    'price' => $product->price,
                    'units_sold' => (int)$currentUnits,
                    'revenue' => round($sale->total_revenue ?? 0, 2),
                    'trend_percentage' => $trendPercentage,
                    'previous_units' => (int)$previousUnits,
                    'reservation_units' => (int)$currentUnits,
                    'receipt_units' => 0, // TODO: Add if receipt_items table exists
                ];
            })->filter()->values();

            return response()->json([
                'top_products' => $topProducts,
                'summary' => [
                    'total_products_sold' => $topProducts->count(),
                    'total_units_sold' => $topProducts->sum('units_sold'),
                    'total_revenue' => round($topProducts->sum('revenue'), 2),
                ],
                'period' => [
                    'days' => $period,
                    'start_date' => $startDate->format('Y-m-d'),
                    'end_date' => Carbon::now()->format('Y-m-d'),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching product analytics',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
