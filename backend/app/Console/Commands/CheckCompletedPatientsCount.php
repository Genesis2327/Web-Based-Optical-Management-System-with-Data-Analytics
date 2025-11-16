<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Branch;
use Carbon\Carbon;

class CheckCompletedPatientsCount extends Command
{
    protected $signature = 'analytics:check-completed-patients';

    protected $description = 'Check unique patients count for COMPLETED appointments (Admin Dashboard calculation)';

    public function handle()
    {
        $period = 30;
        $startDate = Carbon::now()->subDays($period);

        $this->newLine();
        $this->info('🔍 Checking Unique Patients Count for COMPLETED Appointments');
        $this->line("Period: Last {$period} days");
        $this->line("Status Filter: completed only");
        $this->newLine();

        $branches = Branch::where('is_active', true)->get();
        $branchIds = $branches->pluck('id');

        // This is how BranchAnalyticsController calculates it (after the fix)
        $uniquePatientsTotal = Appointment::whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('appointment_date', '>=', $startDate)
            ->distinct('patient_id')
            ->count('patient_id');

        // Get breakdown
        $appointments = Appointment::whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('appointment_date', '>=', $startDate)
            ->get();

        $totalCompletedAppointments = $appointments->count();

        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('Results:');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line("Unique Patients (COMPLETED only): {$uniquePatientsTotal}");
        $this->line("Total Completed Appointments: {$totalCompletedAppointments}");
        $this->newLine();

        // Show by branch
        $this->line('By Branch (completed appointments):');
        foreach ($branches as $branch) {
            $branchAppointments = Appointment::where('branch_id', $branch->id)
                ->where('status', 'completed')
                ->where('appointment_date', '>=', $startDate)
                ->get();
            
            $branchUniquePatients = $branchAppointments->pluck('patient_id')->unique()->count();
            $branchAppointmentCount = $branchAppointments->count();
            $this->line("  - {$branch->name} (ID: {$branch->id}): {$branchUniquePatients} unique patients ({$branchAppointmentCount} completed appointments)");
        }

        $this->newLine();
        $this->info('💡 This matches what Admin Dashboard "Active Patients" should show');

        return 0;
    }
}



