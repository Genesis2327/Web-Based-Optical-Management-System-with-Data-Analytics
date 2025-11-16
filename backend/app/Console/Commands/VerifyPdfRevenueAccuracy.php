<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Receipt;
use App\Models\Reservation;
use App\Models\Transaction;
use Carbon\Carbon;

class VerifyPdfRevenueAccuracy extends Command
{
    protected $signature = 'analytics:verify-pdf-revenue {--period=30 : Number of days} {--branch-id= : Specific branch ID}';

    protected $description = 'Verify PDF report revenue matches system display revenue';

    public function handle()
    {
        $period = (int) $this->option('period');
        $branchId = $this->option('branch-id') ? (int) $this->option('branch-id') : null;
        $startDate = Carbon::now()->subDays($period);
        $endDate = Carbon::now();

        $this->newLine();
        $this->info('🔍 Verifying PDF Report Revenue Accuracy');
        $this->line("Period: Last {$period} days");
        $this->line("Date Range: {$startDate->format('Y-m-d')} to {$endDate->format('Y-m-d')}");
        if ($branchId) {
            $this->line("Branch ID: {$branchId}");
        } else {
            $this->line("Scope: All Branches");
        }
        $this->newLine();

        // Calculate revenue the same way the PDF report does
        // 1. Receipt Revenue
        $receiptQuery = Receipt::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')]);
        if ($branchId) {
            $receiptQuery->where(function($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                  ->orWhereHas('appointment', function($q2) use ($branchId) {
                      $q2->where('branch_id', $branchId);
                  });
            });
        }
        $receiptRevenue = $receiptQuery->sum('total_due') ?? 0;

        // 2. Reservation Revenue
        $reservationQuery = Reservation::with('product')
            ->whereIn('status', ['approved', 'completed'])
            ->whereBetween('created_at', [$startDate, $endDate]);
        if ($branchId) {
            $reservationQuery->where('branch_id', $branchId);
        }
        $reservations = $reservationQuery->get();
        $reservationRevenue = $reservations->sum(function ($reservation) {
            return $reservation->quantity * ($reservation->product->price ?? 0);
        });

        // 3. Transaction Revenue
        $transactionQuery = Transaction::where('status', 'Completed')
            ->whereBetween('created_at', [$startDate, $endDate]);
        if ($branchId) {
            $transactionQuery->where('branch_id', $branchId);
        }
        $transactionRevenue = $transactionQuery->sum('total_amount') ?? 0;

        // Total Revenue (PDF calculation)
        $pdfTotalRevenue = $receiptRevenue + $reservationRevenue + $transactionRevenue;

        // Calculate revenue the way system display does (from AnalyticsController)
        $systemReceiptRevenue = 0;
        try {
            $systemReceiptQuery = Receipt::whereDate('date', '>=', $startDate->format('Y-m-d'))
                ->whereDate('date', '<=', $endDate->format('Y-m-d'));
            if ($branchId) {
                $systemReceiptQuery->where(function($q) use ($branchId) {
                    $q->where('branch_id', $branchId)
                      ->orWhereHas('appointment', function($q2) use ($branchId) {
                          $q2->where('branch_id', $branchId);
                      });
                });
            }
            $systemReceiptRevenue = $systemReceiptQuery->sum('total_due') ?? 0;
        } catch (\Exception $e) {
            \Log::warning('System receipt revenue query failed: ' . $e->getMessage());
        }

        $systemReservations = Reservation::with('product')
            ->whereDate('created_at', '>=', $startDate->format('Y-m-d'))
            ->whereDate('created_at', '<=', $endDate->format('Y-m-d'))
            ->whereIn('status', ['approved', 'completed']);
        if ($branchId) {
            $systemReservations->where('branch_id', $branchId);
        }
        $systemReservations = $systemReservations->get();
        
        $systemReservationRevenue = $systemReservations->sum(function ($reservation) {
            return $reservation->quantity * ($reservation->product->price ?? 0);
        });

        $systemTransactionRevenue = 0;
        try {
            $systemTransactionQuery = Transaction::whereDate('created_at', '>=', $startDate->format('Y-m-d'))
                ->whereDate('created_at', '<=', $endDate->format('Y-m-d'))
                ->where('status', 'Completed');
            if ($branchId) {
                $systemTransactionQuery->where('branch_id', $branchId);
            }
            $systemTransactionRevenue = $systemTransactionQuery->sum('total_amount') ?? 0;
        } catch (\Exception $e) {
            \Log::warning('System transaction revenue query failed: ' . $e->getMessage());
        }

        $systemTotalRevenue = $systemReceiptRevenue + $systemReservationRevenue + $systemTransactionRevenue;

        // Display comparison
        $this->info('📊 Revenue Comparison:');
        $this->newLine();
        
        $this->table(
            ['Source', 'PDF Report', 'System Display', 'Match'],
            [
                [
                    'Receipts',
                    '₱' . number_format($receiptRevenue, 2),
                    '₱' . number_format($systemReceiptRevenue, 2),
                    abs($receiptRevenue - $systemReceiptRevenue) < 0.01 ? '✅' : '❌'
                ],
                [
                    'Reservations',
                    '₱' . number_format($reservationRevenue, 2),
                    '₱' . number_format($systemReservationRevenue, 2),
                    abs($reservationRevenue - $systemReservationRevenue) < 0.01 ? '✅' : '❌'
                ],
                [
                    'Transactions',
                    '₱' . number_format($transactionRevenue, 2),
                    '₱' . number_format($systemTransactionRevenue, 2),
                    abs($transactionRevenue - $systemTransactionRevenue) < 0.01 ? '✅' : '❌'
                ],
                [
                    'TOTAL',
                    '₱' . number_format($pdfTotalRevenue, 2),
                    '₱' . number_format($systemTotalRevenue, 2),
                    abs($pdfTotalRevenue - $systemTotalRevenue) < 0.01 ? '✅' : '❌'
                ],
            ]
        );

        // Check for differences
        if (abs($pdfTotalRevenue - $systemTotalRevenue) > 0.01) {
            $this->newLine();
            $this->error('⚠️  Revenue Mismatch Found!');
            $difference = abs($pdfTotalRevenue - $systemTotalRevenue);
            $this->line("Difference: ₱" . number_format($difference, 2));
            
            if (abs($receiptRevenue - $systemReceiptRevenue) > 0.01) {
                $this->line("  - Receipt revenue differs (PDF uses whereBetween, System uses whereDate)");
            }
            if (abs($reservationRevenue - $systemReservationRevenue) > 0.01) {
                $this->line("  - Reservation revenue differs (PDF uses whereBetween, System uses whereDate)");
            }
            if (abs($transactionRevenue - $systemTransactionRevenue) > 0.01) {
                $this->line("  - Transaction revenue differs (PDF uses whereBetween, System uses whereDate)");
            }
        } else {
            $this->newLine();
            $this->info('✅ PDF Report revenue matches System Display revenue!');
        }

        return 0;
    }
}



