<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\Feedback;
use App\Models\Appointment;
use App\Models\Reservation;
use App\Models\Receipt;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Branch;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Generate analytics PDF report
     */
    public function generateAnalyticsReport(Request $request)
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $period = $request->get('period', 30); // days
        $branchId = $request->get('branch_id');
        $startDate = Carbon::now()->subDays($period);
        $endDate = Carbon::now();

        // Get analytics data
        $analyticsData = $this->getAnalyticsData($startDate, $endDate, $branchId);
        
        // Get branch name if branch ID is provided
        $branchName = null;
        if ($branchId) {
            $branch = Branch::find($branchId);
            $branchName = $branch ? $branch->name : null;
        }

        // Generate PDF
        $pdf = Pdf::loadView('reports.analytics', [
            'analytics' => $analyticsData,
            'period' => $period,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'branchId' => $branchId,
            'branchName' => $branchName,
            'generatedAt' => Carbon::now(),
            'generatedBy' => $user->name ?? 'System Administrator'
        ])->setPaper('a4', 'portrait')
          ->setOption('isHtml5ParserEnabled', true)
          ->setOption('isRemoteEnabled', true)
          ->setOption('defaultFont', 'Arial');

        $filename = 'Analytics_Report_' . Carbon::now()->format('Y-m-d') . '.pdf';
        
        return $pdf->download($filename);
    }

    /**
     * Get comprehensive analytics data - simplified and error-safe
     */
    private function getAnalyticsData($startDate, $endDate, $branchId = null)
    {
        try {
            // Revenue Analytics - Calculate from multiple sources (matching system display exactly)
            // 1. Receipt Revenue (use 'date' field with whereDate, matching system display)
            $receiptQuery = Receipt::whereDate('date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('date', '<=', $endDate->format('Y-m-d'));
            
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

            // 2. Reservation Revenue (calculate properly using quantity * product price, matching system)
            $reservationQuery = Reservation::with('product')
                ->whereIn('status', ['approved', 'completed'])
                ->whereDate('created_at', '>=', $startDate->format('Y-m-d'))
                ->whereDate('created_at', '<=', $endDate->format('Y-m-d'));
            
            if ($branchId) {
                $reservationQuery->where('branch_id', $branchId);
            }
            
            $reservations = $reservationQuery->get();
            $reservationRevenue = $reservations->sum(function ($reservation) {
                return $reservation->quantity * ($reservation->product->price ?? 0);
            });

            // 3. Transaction Revenue (completed transactions, matching system)
            $transactionQuery = Transaction::where('status', 'Completed')
                ->whereDate('created_at', '>=', $startDate->format('Y-m-d'))
                ->whereDate('created_at', '<=', $endDate->format('Y-m-d'));
            
            if ($branchId) {
                $transactionQuery->where('branch_id', $branchId);
            }
            
            $transactionRevenue = $transactionQuery->sum('total_amount') ?? 0;

            // Total Revenue (matching system display calculation)
            $totalRevenue = $receiptRevenue + $reservationRevenue + $transactionRevenue;

            // Appointment Analytics (matching system display)
            $appointmentsQuery = Appointment::whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('appointment_date', '<=', $endDate->format('Y-m-d'));
            if ($branchId) {
                $appointmentsQuery->where('branch_id', $branchId);
            }
            
            $totalAppointments = $appointmentsQuery->count();
            $completedAppointments = $appointmentsQuery->where('status', 'completed')->count();
            $cancelledAppointments = $appointmentsQuery->where('status', 'cancelled')->count();
            
            // Get unique patients count from appointments in the period (matching system display)
            $uniquePatientsQuery = Appointment::whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('appointment_date', '<=', $endDate->format('Y-m-d'));
            if ($branchId) {
                $uniquePatientsQuery->where('branch_id', $branchId);
            }
            $uniquePatients = $uniquePatientsQuery->distinct('patient_id')->count('patient_id');

            // Feedback Analytics
            $feedbackQuery = Feedback::whereBetween('created_at', [$startDate, $endDate]);
            if ($branchId) {
                $feedbackQuery->where('branch_id', $branchId);
            }
            
            $totalFeedback = $feedbackQuery->count();
            $avgRating = $feedbackQuery->avg('rating') ?? 0;
            $uniqueCustomers = $feedbackQuery->distinct('customer_id')->count();

            // Branch Performance - Comprehensive
            $branches = Branch::where('is_active', true)->get();
            $branchPerformance = [];
            
            foreach ($branches as $branch) {
                if ($branchId && $branch->id != $branchId) continue;
                
                $branchAppointments = Appointment::whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                    ->whereDate('appointment_date', '<=', $endDate->format('Y-m-d'))
                    ->where('branch_id', $branch->id)->count();
                
                // Calculate branch revenue from multiple sources (matching system display exactly)
                // 1. Receipt Revenue (use 'date' field with whereDate)
                $branchReceiptRevenue = 0;
                try {
                    $branchReceiptRevenue = Receipt::where('branch_id', $branch->id)
                        ->whereDate('date', '>=', $startDate->format('Y-m-d'))
                        ->whereDate('date', '<=', $endDate->format('Y-m-d'))
                        ->sum('total_due') ?? 0;
                } catch (\Exception $e) {
                    try {
                        $branchReceiptRevenue = Receipt::whereHas('appointment', function($q) use ($startDate, $endDate, $branch) {
                            $q->whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                              ->whereDate('appointment_date', '<=', $endDate->format('Y-m-d'))
                              ->where('branch_id', $branch->id);
                        })->whereDate('date', '>=', $startDate->format('Y-m-d'))
                          ->whereDate('date', '<=', $endDate->format('Y-m-d'))
                          ->sum('total_due') ?? 0;
                    } catch (\Exception $e2) {
                        try {
                            $branchReceiptRevenue = Receipt::where('branch_id', $branch->id)
                                ->whereDate('created_at', '>=', $startDate->format('Y-m-d'))
                                ->whereDate('created_at', '<=', $endDate->format('Y-m-d'))
                                ->sum('total_due') ?? 0;
                        } catch (\Exception $e3) {
                            \Log::warning('Branch receipt revenue calculation failed for branch ' . $branch->id . ': ' . $e3->getMessage());
                            $branchReceiptRevenue = 0;
                        }
                    }
                }

                // 2. Reservation Revenue (matching system calculation)
                $branchReservations = Reservation::with('product')
                    ->where('branch_id', $branch->id)
                    ->whereIn('status', ['approved', 'completed'])
                    ->whereDate('created_at', '>=', $startDate->format('Y-m-d'))
                    ->whereDate('created_at', '<=', $endDate->format('Y-m-d'))
                    ->get();
                
                $branchReservationRevenue = $branchReservations->sum(function ($reservation) {
                    return $reservation->quantity * ($reservation->product->price ?? 0);
                });

                // 3. Transaction Revenue (matching system calculation)
                $branchTransactionRevenue = 0;
                try {
                    $branchTransactionRevenue = Transaction::where('branch_id', $branch->id)
                        ->where('status', 'Completed')
                        ->whereDate('created_at', '>=', $startDate->format('Y-m-d'))
                        ->whereDate('created_at', '<=', $endDate->format('Y-m-d'))
                        ->sum('total_amount') ?? 0;
                } catch (\Exception $e) {
                    \Log::warning('Branch transaction revenue calculation failed for branch ' . $branch->id . ': ' . $e->getMessage());
                }

                // Total Branch Revenue
                $branchTotalRevenue = $branchReceiptRevenue + $branchReservationRevenue + $branchTransactionRevenue;
                    
                $branchFeedback = Feedback::whereBetween('created_at', [$startDate, $endDate])
                    ->where('branch_id', $branch->id)
                    ->avg('rating') ?? 0;

                $branchPerformance[] = [
                    'name' => $branch->name,
                    'appointments' => $branchAppointments,
                    'revenue' => round($branchTotalRevenue, 2), // Total revenue from all sources
                    'avg_rating' => round($branchFeedback, 2)
                ];
            }

            // Top Services (matching system display)
            $topServices = Appointment::whereDate('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('appointment_date', '<=', $endDate->format('Y-m-d'));
            if ($branchId) {
                $topServices->where('branch_id', $branchId);
            }
            $topServices = $topServices->select('type', DB::raw('COUNT(*) as count'))
                ->whereNotNull('type')
                ->where('type', '!=', '')
                ->groupBy('type')
                ->orderBy('count', 'desc')
                ->limit(5)
                ->get();

            // Revenue Distribution by Time Period
            $revenueDistribution = $this->getRevenueDistribution($startDate, $endDate, $branchId, $totalRevenue);

            return [
                'revenue' => [
                    'total' => round($totalRevenue, 2),
                    'receipts' => round($receiptRevenue, 2),
                    'reservations' => round($reservationRevenue, 2),
                    'transactions' => round($transactionRevenue, 2)
                ],
                'appointments' => [
                    'total' => $totalAppointments,
                    'completed' => $completedAppointments,
                    'cancelled' => $cancelledAppointments,
                    'completion_rate' => $totalAppointments > 0 ? round(($completedAppointments / $totalAppointments) * 100, 2) : 0
                ],
                'patients' => [
                    'unique_total' => $uniquePatients
                ],
                'feedback' => [
                    'total' => $totalFeedback,
                    'avg_rating' => round($avgRating, 2),
                    'unique_customers' => $uniqueCustomers,
                    'response_rate' => $totalAppointments > 0 ? round(($totalFeedback / $totalAppointments) * 100, 2) : 0
                ],
                'branch_performance' => $branchPerformance,
                'top_services' => $topServices,
                'revenue_distribution' => $revenueDistribution
            ];
        } catch (\Exception $e) {
            \Log::error('Error generating analytics data for PDF: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            // Return empty data structure to prevent PDF generation failure
            return [
                'revenue' => ['total' => 0, 'receipts' => 0],
                'appointments' => ['total' => 0, 'completed' => 0, 'cancelled' => 0, 'completion_rate' => 0],
                'feedback' => ['total' => 0, 'avg_rating' => 0, 'unique_customers' => 0, 'response_rate' => 0],
                'branch_performance' => [],
                'top_services' => [],
                'revenue_distribution' => []
            ];
        }
    }

    /**
     * Get revenue distribution by time period
     */
    private function getRevenueDistribution($startDate, $endDate, $branchId = null, $totalRevenue)
    {
        $daysDiff = $startDate->diffInDays($endDate) + 1;
        $distribution = [];
        
        // For periods <= 30 days, show daily breakdown
        // For periods > 30 days, show weekly breakdown
        $groupByWeek = $daysDiff > 30;
        
        $currentDate = $startDate->copy();
        
        while ($currentDate->lte($endDate)) {
            if ($groupByWeek) {
                // Group by week
                $weekStart = $currentDate->copy()->startOfWeek();
                $weekEnd = $currentDate->copy()->endOfWeek();
                if ($weekEnd->gt($endDate)) {
                    $weekEnd = $endDate->copy();
                }
                
                $periodKey = $weekStart->format('Y-m-d') . ' to ' . $weekEnd->format('Y-m-d');
                
                // Check if we already have this week
                if (isset($distribution[$periodKey])) {
                    $currentDate = $weekEnd->copy()->addDay();
                    continue;
                }
                
                // Calculate revenue for this week
                $weekReceiptRevenue = 0;
                $receiptQuery = Receipt::whereDate('date', '>=', $weekStart->format('Y-m-d'))
                    ->whereDate('date', '<=', $weekEnd->format('Y-m-d'));
                if ($branchId) {
                    $receiptQuery->where(function($q) use ($branchId) {
                        $q->where('branch_id', $branchId)
                          ->orWhereHas('appointment', function($q2) use ($branchId) {
                              $q2->where('branch_id', $branchId);
                          });
                    });
                }
                $weekReceiptRevenue = $receiptQuery->sum('total_due') ?? 0;

                $weekReservations = Reservation::with('product')
                    ->whereIn('status', ['approved', 'completed'])
                    ->whereDate('created_at', '>=', $weekStart->format('Y-m-d'))
                    ->whereDate('created_at', '<=', $weekEnd->format('Y-m-d'));
                if ($branchId) {
                    $weekReservations->where('branch_id', $branchId);
                }
                $weekReservationRevenue = $weekReservations->get()->sum(function ($reservation) {
                    return $reservation->quantity * ($reservation->product->price ?? 0);
                });

                $weekTransactionRevenue = 0;
                try {
                    $transactionQuery = Transaction::where('status', 'Completed')
                        ->whereDate('created_at', '>=', $weekStart->format('Y-m-d'))
                        ->whereDate('created_at', '<=', $weekEnd->format('Y-m-d'));
                    if ($branchId) {
                        $transactionQuery->where('branch_id', $branchId);
                    }
                    $weekTransactionRevenue = $transactionQuery->sum('total_amount') ?? 0;
                } catch (\Exception $e) {
                    // Transaction table might not exist
                }

                $weekTotal = $weekReceiptRevenue + $weekReservationRevenue + $weekTransactionRevenue;
                
                $distribution[$periodKey] = [
                    'period' => 'Week of ' . $weekStart->format('M d, Y'),
                    'revenue' => round($weekTotal, 2),
                    'percentage' => $totalRevenue > 0 ? round(($weekTotal / $totalRevenue) * 100, 1) : 0,
                    'receipts' => round($weekReceiptRevenue, 2),
                    'reservations' => round($weekReservationRevenue, 2),
                    'transactions' => round($weekTransactionRevenue, 2)
                ];
                
                $currentDate = $weekEnd->copy()->addDay();
            } else {
                // Daily breakdown
                $dateStr = $currentDate->format('Y-m-d');
                
                $dayReceiptRevenue = 0;
                $receiptQuery = Receipt::whereDate('date', $dateStr);
                if ($branchId) {
                    $receiptQuery->where(function($q) use ($branchId) {
                        $q->where('branch_id', $branchId)
                          ->orWhereHas('appointment', function($q2) use ($branchId) {
                              $q2->where('branch_id', $branchId);
                          });
                    });
                }
                $dayReceiptRevenue = $receiptQuery->sum('total_due') ?? 0;

                $dayReservations = Reservation::with('product')
                    ->whereIn('status', ['approved', 'completed'])
                    ->whereDate('created_at', $dateStr);
                if ($branchId) {
                    $dayReservations->where('branch_id', $branchId);
                }
                $dayReservationRevenue = $dayReservations->get()->sum(function ($reservation) {
                    return $reservation->quantity * ($reservation->product->price ?? 0);
                });

                $dayTransactionRevenue = 0;
                try {
                    $transactionQuery = Transaction::where('status', 'Completed')
                        ->whereDate('created_at', $dateStr);
                    if ($branchId) {
                        $transactionQuery->where('branch_id', $branchId);
                    }
                    $dayTransactionRevenue = $transactionQuery->sum('total_amount') ?? 0;
                } catch (\Exception $e) {
                    // Transaction table might not exist
                }

                $dayTotal = $dayReceiptRevenue + $dayReservationRevenue + $dayTransactionRevenue;
                
                // Only include days with revenue
                if ($dayTotal > 0) {
                    $distribution[] = [
                        'period' => $currentDate->format('M d, Y'),
                        'revenue' => round($dayTotal, 2),
                        'percentage' => $totalRevenue > 0 ? round(($dayTotal / $totalRevenue) * 100, 1) : 0,
                        'receipts' => round($dayReceiptRevenue, 2),
                        'reservations' => round($dayReservationRevenue, 2),
                        'transactions' => round($dayTransactionRevenue, 2)
                    ];
                }
                
                $currentDate->addDay();
            }
        }
        
        return array_values($distribution);
    }
}

