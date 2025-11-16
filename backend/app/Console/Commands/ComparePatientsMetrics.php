<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Branch;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ComparePatientsMetrics extends Command
{
    protected $signature = 'analytics:compare-patients-metrics';

    protected $description = 'Compare Total Patients (Analytics) vs Active Patients (Admin Dashboard)';

    public function handle()
    {
        $this->newLine();
        $this->info('📊 Comparing Total Patients vs Active Patients');
        $this->newLine();

        $startDate = Carbon::now()->subDays(30);
        $branches = Branch::where('is_active', true)->get();
        $branchIds = $branches->pluck('id');

        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('1️⃣  ADMIN DASHBOARD - "Active Patients"');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('Source: BranchAnalyticsController::getBranchPerformance()');
        $this->line('Calculation: Unique patients from COMPLETED appointments only');
        $this->line('Time Period: Last 30 days');
        $this->line('Filter: status = "completed"');
        $this->newLine();

        // Admin Dashboard calculation (BranchAnalyticsController)
        $adminDashboardAppointments = DB::table('appointments')
            ->select('branch_id', 'patient_id', 'appointment_date')
            ->whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('appointment_date', '>=', $startDate)
            ->get()
            ->groupBy('branch_id');

        $adminDashboardPatients = [];
        foreach ($adminDashboardAppointments as $branchId => $appointments) {
            $uniquePatients = $appointments->pluck('patient_id')->unique()->count();
            $branch = $branches->firstWhere('id', $branchId);
            $adminDashboardPatients[$branchId] = [
                'branch_name' => $branch ? $branch->name : "Branch {$branchId}",
                'patients' => $uniquePatients,
                'total_appointments' => $appointments->count()
            ];
        }

        $adminTotalPatients = collect($adminDashboardPatients)->sum('patients');
        $adminTotalAppointments = collect($adminDashboardPatients)->sum('total_appointments');

        $this->line("Total Active Patients (Admin Dashboard): {$adminTotalPatients}");
        $this->line("Total Completed Appointments: {$adminTotalAppointments}");
        $this->newLine();
        $this->line('Breakdown by Branch:');
        foreach ($adminDashboardPatients as $branchId => $data) {
            $this->line("  - {$data['branch_name']}: {$data['patients']} patients ({$data['total_appointments']} completed appointments)");
        }

        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('2️⃣  ANALYTICS DASHBOARD - "Total Patients"');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('Source: AnalyticsController::getBranchPerformance()');
        $this->line('Calculation: Unique patients from ALL appointments (any status)');
        $this->line('Time Period: Last 30 days');
        $this->line('Filter: NO status filter (includes scheduled, completed, cancelled, etc.)');
        $this->newLine();

        // Analytics Dashboard calculation (AnalyticsController)
        $analyticsDashboardPatients = [];
        foreach ($branches as $branch) {
            $appointments = $branch->appointments()
                ->where('appointment_date', '>=', $startDate->format('Y-m-d'))
                ->get();
            
            $uniquePatients = $appointments->pluck('patient_id')->unique()->count();
            
            $analyticsDashboardPatients[$branch->id] = [
                'branch_name' => $branch->name,
                'patients' => $uniquePatients,
                'total_appointments' => $appointments->count(),
                'by_status' => $appointments->groupBy('status')->map->count()
            ];
        }

        $analyticsTotalPatients = collect($analyticsDashboardPatients)->sum('patients');
        $analyticsTotalAppointments = collect($analyticsDashboardPatients)->sum('total_appointments');

        $this->line("Total Patients (Analytics Dashboard): {$analyticsTotalPatients}");
        $this->line("Total Appointments (all statuses): {$analyticsTotalAppointments}");
        $this->newLine();
        $this->line('Breakdown by Branch:');
        foreach ($analyticsDashboardPatients as $branchId => $data) {
            $statusBreakdown = collect($data['by_status'])->map(function($count, $status) {
                return "{$status}: {$count}";
            })->join(', ');
            $this->line("  - {$data['branch_name']}: {$data['patients']} patients ({$data['total_appointments']} appointments)");
            $this->line("    Statuses: {$statusBreakdown}");
        }

        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('🔍 KEY DIFFERENCES');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        $difference = abs($adminTotalPatients - $analyticsTotalPatients);
        $this->line("Difference: {$difference} patients");
        $this->newLine();

        $this->line('✅ Admin Dashboard (Active Patients):');
        $this->line('   - Only counts COMPLETED appointments');
        $this->line('   - More conservative metric');
        $this->line('   - Shows patients who actually visited');
        $this->line('   - Excludes scheduled, cancelled, no-show appointments');
        $this->newLine();

        $this->line('✅ Analytics Dashboard (Total Patients):');
        $this->line('   - Counts ALL appointments (any status)');
        $this->line('   - More inclusive metric');
        $this->line('   - Shows all patients who booked (even if not completed)');
        $this->line('   - Includes scheduled, completed, cancelled, no-show');
        $this->newLine();

        $this->info('💡 Recommendation:');
        if ($adminTotalPatients < $analyticsTotalPatients) {
            $missingCount = $analyticsTotalPatients - $adminTotalPatients;
            $this->line("   - Admin Dashboard shows {$missingCount} fewer patients");
            $this->line("   - These are patients with appointments that are not yet completed");
            $this->line("   - Consider whether 'Active Patients' should include all appointments or only completed");
        } else {
            $this->line("   - Both metrics are the same or Admin has more (unusual)");
        }

        $this->newLine();

        return 0;
    }
}



