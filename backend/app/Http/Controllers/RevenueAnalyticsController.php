<?php

namespace App\Http\Controllers;

use App\Models\Receipt;
use App\Models\ReceiptItem;
use App\Models\Reservation;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class RevenueAnalyticsController extends Controller
{
    /**
     * Get monthly comparison analytics
     * GET /api/admin/revenue/monthly-comparison
     */
    public function getMonthlyComparison(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $branchId = $request->get('branch_id');
        
        // Get current month data
        $currentMonth = Carbon::now()->startOfMonth();
        $currentMonthEnd = Carbon::now()->endOfMonth();
        
        // Get previous month data
        $previousMonth = Carbon::now()->subMonth()->startOfMonth();
        $previousMonthEnd = Carbon::now()->subMonth()->endOfMonth();

        // Get revenue from receipts (current month)
        $currentMonthReceiptRevenue = $this->getReceiptRevenue($currentMonth, $currentMonthEnd, $branchId);
        
        // Get revenue from reservations (current month)
        $currentMonthReservationRevenue = $this->getReservationRevenue($currentMonth, $currentMonthEnd, $branchId);
        
        // Get appointment fees (current month)
        $currentMonthAppointmentRevenue = $this->getAppointmentRevenue($currentMonth, $currentMonthEnd, $branchId);
        
        $currentMonthTotal = $currentMonthReceiptRevenue + $currentMonthReservationRevenue + $currentMonthAppointmentRevenue;

        // Get previous month data
        $previousMonthReceiptRevenue = $this->getReceiptRevenue($previousMonth, $previousMonthEnd, $branchId);
        $previousMonthReservationRevenue = $this->getReservationRevenue($previousMonth, $previousMonthEnd, $branchId);
        $previousMonthAppointmentRevenue = $this->getAppointmentRevenue($previousMonth, $previousMonthEnd, $branchId);
        
        $previousMonthTotal = $previousMonthReceiptRevenue + $previousMonthReservationRevenue + $previousMonthAppointmentRevenue;

        // Calculate growth percentage
        $growthPercentage = 0;
        if ($previousMonthTotal > 0) {
            $growthPercentage = (($currentMonthTotal - $previousMonthTotal) / $previousMonthTotal) * 100;
        } else if ($currentMonthTotal > 0) {
            $growthPercentage = 100; // First month with revenue
        }

        return response()->json([
            'current_month' => [
                'revenue' => $currentMonthTotal,
                'period' => $currentMonth->format('M Y')
            ],
            'last_month' => [
                'revenue' => $previousMonthTotal,
                'period' => $previousMonth->format('M Y')
            ],
            'growth_percentage' => round($growthPercentage, 1),
            'growth_amount' => $currentMonthTotal - $previousMonthTotal
        ]);
    }

    /**
     * Get revenue by service breakdown
     * GET /api/admin/revenue/by-service
     */
    public function getRevenueByService(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $branchId = $request->get('branch_id');
        $period = $request->get('period', 30); // days
        
        $startDate = Carbon::now()->subDays($period);
        $endDate = Carbon::now();

        // Get revenue from different sources
        $services = [];

        // 1. Eye Examinations (from appointments)
        $eyeExaminationRevenue = $this->getAppointmentRevenue($startDate, $endDate, $branchId);
        $eyeExaminationCount = $this->getAppointmentCount($startDate, $endDate, $branchId);
        
        // 2. Frame Sales (from receipts and reservations)
        $frameSalesRevenue = $this->getFrameSalesRevenue($startDate, $endDate, $branchId);
        
        // 3. Contact Lenses (from receipts and reservations)
        $contactLensRevenue = $this->getContactLensRevenue($startDate, $endDate, $branchId);
        
        // 4. Other Services (prescription fees, consultations, etc.)
        $otherServicesRevenue = $this->getOtherServicesRevenue($startDate, $endDate, $branchId);

        $totalRevenue = $eyeExaminationRevenue + $frameSalesRevenue + $contactLensRevenue + $otherServicesRevenue;

        // Build services array
        if ($eyeExaminationRevenue > 0) {
            $services[] = [
                'name' => 'Eye Examinations',
                'revenue' => $eyeExaminationRevenue,
                'percentage' => $totalRevenue > 0 ? round(($eyeExaminationRevenue / $totalRevenue) * 100, 1) : 0,
                'count' => $eyeExaminationCount,
                'average_price' => $eyeExaminationCount > 0 ? round($eyeExaminationRevenue / $eyeExaminationCount, 2) : 0,
            ];
        }

        if ($frameSalesRevenue > 0) {
            $services[] = [
                'name' => 'Frame Sales',
                'revenue' => $frameSalesRevenue,
                'percentage' => $totalRevenue > 0 ? round(($frameSalesRevenue / $totalRevenue) * 100, 1) : 0,
                'count' => 0, // Can be calculated separately if needed
                'average_price' => 0,
            ];
        }

        if ($contactLensRevenue > 0) {
            $services[] = [
                'name' => 'Contact Lenses',
                'revenue' => $contactLensRevenue,
                'percentage' => $totalRevenue > 0 ? round(($contactLensRevenue / $totalRevenue) * 100, 1) : 0,
                'count' => 0,
                'average_price' => 0,
            ];
        }

        if ($otherServicesRevenue > 0) {
            $services[] = [
                'name' => 'Other Services',
                'revenue' => $otherServicesRevenue,
                'percentage' => $totalRevenue > 0 ? round(($otherServicesRevenue / $totalRevenue) * 100, 1) : 0,
                'count' => 0,
                'average_price' => 0,
            ];
        }

        // Sort by revenue (descending)
        usort($services, function($a, $b) {
            return $b['revenue'] - $a['revenue'];
        });

        return response()->json([
            'services' => $services,
            'total_revenue' => $totalRevenue,
            'period_days' => $period,
            'date_range' => [
                'start' => $startDate->format('Y-m-d'),
                'end' => $endDate->format('Y-m-d'),
            ],
            'branch_id' => $branchId,
        ]);
    }

    /**
     * Get revenue from receipts
     */
    private function getReceiptRevenue($startDate, $endDate, $branchId = null)
    {
        $query = Receipt::where('payment_status', 'paid')
            ->whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        return $query->sum('total_due');
    }

    /**
     * Get revenue from reservations
     * Not counted - reservations are included in receipts when approved
     */
    private function getReservationRevenue($startDate, $endDate, $branchId = null)
    {
        return 0;
    }

    /**
     * Get revenue from appointments (examination fees)
     */
    private function getAppointmentRevenue($startDate, $endDate, $branchId = null)
    {
        $query = Appointment::where('status', 'completed')
            ->whereBetween('appointment_date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $appointmentCount = $query->count();
        
        // Standard examination fee (can be made configurable)
        $examinationFee = 500; // PHP
        
        return $appointmentCount * $examinationFee;
    }

    /**
     * Get appointment count
     */
    private function getAppointmentCount($startDate, $endDate, $branchId = null)
    {
        $query = Appointment::where('status', 'completed')
            ->whereBetween('appointment_date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        return $query->count();
    }

    /**
     * Get frame sales revenue from receipts and reservations
     */
    private function getFrameSalesRevenue($startDate, $endDate, $branchId = null)
    {
        // From receipts
        $receiptRevenue = DB::table('receipt_items')
            ->join('receipts', 'receipt_items.receipt_id', '=', 'receipts.id')
            ->where('receipts.payment_status', 'paid')
            ->whereBetween('receipts.date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->where(function($query) {
                $query->where('receipt_items.description', 'LIKE', '%frame%')
                      ->orWhere('receipt_items.description', 'LIKE', '%eyeglass%')
                      ->orWhere('receipt_items.description', 'LIKE', '%spectacle%')
                      ->orWhere('receipt_items.description', 'LIKE', '%lens%');
            });

        if ($branchId) {
            $receiptRevenue->where('receipts.branch_id', $branchId);
        }

        $receiptTotal = $receiptRevenue->sum('receipt_items.amount');

        // From reservations - Not counted (reservations are included in receipts when approved)
        $reservationTotal = 0;

        return $receiptTotal + $reservationTotal;
    }

    /**
     * Get contact lens revenue
     */
    private function getContactLensRevenue($startDate, $endDate, $branchId = null)
    {
        // From receipts
        $receiptRevenue = DB::table('receipt_items')
            ->join('receipts', 'receipt_items.receipt_id', '=', 'receipts.id')
            ->where('receipts.payment_status', 'paid')
            ->whereBetween('receipts.date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->where('receipt_items.description', 'LIKE', '%contact%');

        if ($branchId) {
            $receiptRevenue->where('receipts.branch_id', $branchId);
        }

        $receiptTotal = $receiptRevenue->sum('receipt_items.amount');

        // From reservations - Not counted (reservations are included in receipts when approved)
        $reservationTotal = 0;

        return $receiptTotal + $reservationTotal;
    }

    /**
     * Get other services revenue
     */
    private function getOtherServicesRevenue($startDate, $endDate, $branchId = null)
    {
        // From receipts (exclude frames and contacts)
        $receiptRevenue = DB::table('receipt_items')
            ->join('receipts', 'receipt_items.receipt_id', '=', 'receipts.id')
            ->where('receipts.payment_status', 'paid')
            ->whereBetween('receipts.date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->where(function($query) {
                $query->where('receipt_items.description', 'LIKE', '%consultation%')
                      ->orWhere('receipt_items.description', 'LIKE', '%prescription%')
                      ->orWhere('receipt_items.description', 'LIKE', '%service%')
                      ->orWhere('receipt_items.description', 'LIKE', '%treatment%');
            });

        if ($branchId) {
            $receiptRevenue->where('receipts.branch_id', $branchId);
        }

        return $receiptRevenue->sum('receipt_items.amount');
    }
}
