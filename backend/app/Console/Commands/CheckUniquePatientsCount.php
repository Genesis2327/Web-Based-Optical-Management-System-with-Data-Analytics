<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Branch;
use Carbon\Carbon;

class CheckUniquePatientsCount extends Command
{
    protected $signature = 'analytics:check-patients {--branch-id= : Specific branch ID to check}';

    protected $description = 'Check unique patients count as calculated by analytics trends endpoint';

    public function handle()
    {
        $branchId = $this->option('branch-id') ? (int) $this->option('branch-id') : null;
        $period = 30;
        $startDate = Carbon::now()->subDays($period);

        $this->newLine();
        $this->info('🔍 Checking Unique Patients Count (Analytics Trends Calculation)');
        $this->line("Period: Last {$period} days");
        $this->line("Branch Filter: " . ($branchId ? "Branch ID {$branchId}" : "All Branches"));
        $this->newLine();

        // This is how the analytics trends endpoint calculates it
        $uniquePatientsQuery = Appointment::whereBetween('appointment_date', [
            $startDate->format('Y-m-d'),
            Carbon::now()->format('Y-m-d')
        ]);
        
        if ($branchId) {
            $uniquePatientsQuery->where('branch_id', $branchId);
            $branch = Branch::find($branchId);
            $this->line("Branch: " . ($branch ? $branch->name : "Unknown"));
        }
        
        $uniquePatientsTotal = $uniquePatientsQuery->distinct('patient_id')->count('patient_id');
        
        // Get breakdown
        $appointments = $uniquePatientsQuery->get();
        $totalAppointments = $appointments->count();
        $statusBreakdown = $appointments->groupBy('status')->map->count();

        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('Results:');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line("Unique Patients Total: {$uniquePatientsTotal}");
        $this->line("Total Appointments: {$totalAppointments}");
        $this->newLine();
        
        $this->line('Appointment Status Breakdown:');
        foreach ($statusBreakdown as $status => $count) {
            $this->line("  - {$status}: {$count}");
        }

        $this->newLine();
        
        // Show by branch if not filtered
        if (!$branchId) {
            $this->line('By Branch:');
            $branches = Branch::where('is_active', true)->get();
            foreach ($branches as $branch) {
                $branchAppointments = Appointment::whereBetween('appointment_date', [
                    $startDate->format('Y-m-d'),
                    Carbon::now()->format('Y-m-d')
                ])->where('branch_id', $branch->id)->get();
                
                $branchUniquePatients = $branchAppointments->pluck('patient_id')->unique()->count();
                $this->line("  - {$branch->name} (ID: {$branch->id}): {$branchUniquePatients} unique patients");
            }
        }

        $this->newLine();
        $this->info('💡 This matches what Analytics Dashboard should show');

        return 0;
    }
}



