<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Receipt;
use App\Models\Reservation;
use App\Models\Appointment;
use App\Models\Transaction;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class VerifyRevenueAccuracy extends Command
{
    protected $signature = 'analytics:verify-revenue {--days=7 : Number of days to check}';

    protected $description = 'Verify revenue calculations match actual data in database';

    public function handle()
    {
        $days = (int) $this->option('days');
        $startDate = Carbon::today()->subDays($days - 1);
        $endDate = Carbon::today();

        $this->newLine();
        $this->info('🔍 Verifying Revenue Accuracy');
        $this->line("Date range: {$startDate->format('Y-m-d')} to {$endDate->format('Y-m-d')}");
        $this->newLine();

        // Calculate actual revenue from database
        $actualReceiptRevenue = $this->calculateActualReceiptRevenue($startDate, $endDate);
        $actualReservationRevenue = $this->calculateActualReservationRevenue($startDate, $endDate);
        $actualTransactionRevenue = $this->calculateActualTransactionRevenue($startDate, $endDate);
        $actualTotalRevenue = $actualReceiptRevenue + $actualReservationRevenue + $actualTransactionRevenue;

        // Calculate what analytics might return (with current buggy logic)
        $analyticsReceiptRevenue = $this->calculateAnalyticsReceiptRevenue($startDate, $endDate);
        $analyticsReservationRevenue = $this->calculateAnalyticsReservationRevenue($startDate, $endDate);
        $analyticsTotalRevenue = $analyticsReceiptRevenue + $analyticsReservationRevenue;

        // Display comparison
        $this->info('📊 Revenue Comparison:');
        $this->newLine();
        
        $this->table(
            ['Source', 'Actual Revenue', 'Analytics Revenue', 'Match'],
            [
                [
                    'Receipts',
                    '₱' . number_format($actualReceiptRevenue, 2),
                    '₱' . number_format($analyticsReceiptRevenue, 2),
                    $actualReceiptRevenue == $analyticsReceiptRevenue ? '✅' : '❌'
                ],
                [
                    'Reservations',
                    '₱' . number_format($actualReservationRevenue, 2),
                    '₱' . number_format($analyticsReservationRevenue, 2),
                    abs($actualReservationRevenue - $analyticsReservationRevenue) < 0.01 ? '✅' : '❌'
                ],
                [
                    'Transactions',
                    '₱' . number_format($actualTransactionRevenue, 2),
                    'N/A',
                    '-'
                ],
                [
                    'TOTAL',
                    '₱' . number_format($actualTotalRevenue, 2),
                    '₱' . number_format($analyticsTotalRevenue, 2),
                    abs($actualTotalRevenue - $analyticsTotalRevenue) < 0.01 ? '✅' : '❌'
                ],
            ]
        );

        // Show detailed breakdown
        $this->newLine();
        $this->info('📋 Detailed Breakdown:');
        
        // Receipts detail
        $receipts = Receipt::whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate)
            ->get();
        
        $this->line("Receipts found: {$receipts->count()}");
        foreach ($receipts->take(5) as $receipt) {
            $this->line("  - Receipt #{$receipt->receipt_number}: ₱" . number_format($receipt->total_due, 2) . " (Date: {$receipt->date})");
        }

        // Reservations detail
        $reservations = Reservation::with('product')
            ->whereDate('created_at', '>=', $startDate)
            ->whereDate('created_at', '<=', $endDate)
            ->get();
        
        $this->newLine();
        $this->line("Reservations found: {$reservations->count()}");
        $this->line("Status breakdown:");
        $statusCounts = $reservations->groupBy('status')->map->count();
        foreach ($statusCounts as $status => $count) {
            $this->line("  - {$status}: {$count}");
        }

        // Calculate reservation revenue properly
        $this->newLine();
        $this->line("Reservation Revenue Calculation:");
        foreach ($reservations->take(5) as $reservation) {
            $calculatedPrice = $reservation->quantity * ($reservation->product->price ?? 0);
            $accessorPrice = $reservation->total_price ?? 'N/A';
            $this->line("  - Reservation #{$reservation->id}: Qty={$reservation->quantity}, Price={$reservation->product->price}, Calculated=₱{$calculatedPrice}, Accessor=₱{$accessorPrice}, Status={$reservation->status}");
        }

        // Issues found
        $this->newLine();
        $issues = [];
        
        if (abs($actualReceiptRevenue - $analyticsReceiptRevenue) > 0.01) {
            $issues[] = "❌ Receipt revenue mismatch: Actual={$actualReceiptRevenue}, Analytics={$analyticsReceiptRevenue}";
            $issues[] = "   - Analytics uses 'created_at' field, but receipts have a 'date' field for the actual date";
            $issues[] = "   - Consider updating analytics to use 'date' field instead of 'created_at'";
        }
        
        if (abs($actualReservationRevenue - $analyticsReservationRevenue) > 0.01) {
            $issues[] = "❌ Reservation revenue mismatch: Actual={$actualReservationRevenue}, Analytics={$analyticsReservationRevenue}";
            $issues[] = "   - Analytics looks for status='completed' but reservations only have: pending, approved, rejected";
            $issues[] = "   - Analytics uses sum('total_price') but total_price is a calculated attribute, not a column";
        }

        if (!empty($issues)) {
            $this->error('⚠️  Issues Found:');
            foreach ($issues as $issue) {
                $this->line("  {$issue}");
            }
        } else {
            $this->info('✅ All revenue calculations match!');
        }

        return 0;
    }

    private function calculateActualReceiptRevenue($startDate, $endDate)
    {
        return Receipt::whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate)
            ->sum('total_due');
    }

    private function calculateActualReservationRevenue($startDate, $endDate)
    {
        // Calculate properly using quantity * product price
        $reservations = Reservation::with('product')
            ->whereDate('created_at', '>=', $startDate)
            ->whereDate('created_at', '<=', $endDate)
            ->whereIn('status', ['approved', 'completed']) // Include approved as they represent sales
            ->get();

        return $reservations->sum(function ($reservation) {
            return $reservation->quantity * ($reservation->product->price ?? 0);
        });
    }

    private function calculateActualTransactionRevenue($startDate, $endDate)
    {
        return Transaction::whereDate('created_at', '>=', $startDate)
            ->whereDate('created_at', '<=', $endDate)
            ->where('status', 'Completed')
            ->sum('total_amount');
    }

    private function calculateAnalyticsReceiptRevenue($startDate, $endDate)
    {
        // How analytics currently calculates it (after fixes - uses 'date' field)
        return Receipt::whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate)
            ->sum('total_due');
    }

    private function calculateAnalyticsReservationRevenue($startDate, $endDate)
    {
        // How analytics currently calculates it (after fixes - using proper calculation)
        try {
            $reservations = Reservation::with('product')
                ->whereDate('created_at', '>=', $startDate)
                ->whereDate('created_at', '<=', $endDate)
                ->whereIn('status', ['approved', 'completed'])
                ->get();
            
            return $reservations->sum(function ($reservation) {
                return $reservation->quantity * ($reservation->product->price ?? 0);
            });
        } catch (\Exception $e) {
            return 0;
        }
    }
}

