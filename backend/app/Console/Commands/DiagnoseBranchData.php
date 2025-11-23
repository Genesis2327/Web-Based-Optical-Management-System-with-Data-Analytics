<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Receipt;
use App\Models\Branch;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DiagnoseBranchData extends Command
{
    protected $signature = 'diagnose:branch-data {branch_id?}';

    protected $description = 'Diagnose branch data to find why appointments/patients show 0';

    public function handle()
    {
        $branchId = $this->argument('branch_id');
        
        if ($branchId) {
            $branchId = (int) $branchId;
            $branch = Branch::find($branchId);
            if (!$branch) {
                $this->error("Branch with ID {$branchId} not found!");
                return 1;
            }
            $this->info("Checking data for branch: {$branch->name} (ID: {$branchId})");
        } else {
            // Find Unitop branch
            $branch = Branch::where('name', 'like', '%Unitop%')->orWhere('code', 'UNITOP')->first();
            if (!$branch) {
                $this->error("Unitop branch not found!");
                $this->line("Available branches:");
                Branch::all()->each(function($b) {
                    $this->line("  - ID: {$b->id}, Name: {$b->name}, Code: {$b->code}");
                });
                return 1;
            }
            $branchId = $branch->id;
            $this->info("Found Unitop branch: {$branch->name} (ID: {$branchId})");
        }
        
        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('1. APPOINTMENTS DATA');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Check appointments with direct branch_id
        $directAppointments = Appointment::where('branch_id', $branchId)->count();
        $this->line("Appointments with branch_id = {$branchId}: {$directAppointments}");
        
        // Check appointments with NULL branch_id
        $nullBranchAppointments = Appointment::whereNull('branch_id')->count();
        $this->line("Appointments with NULL branch_id: {$nullBranchAppointments}");
        
        // Check appointments linked to receipts with this branch_id
        $appointmentsViaReceipts = Appointment::whereHas('receipt', function($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })->count();
        $this->line("Appointments linked to receipts with branch_id = {$branchId}: {$appointmentsViaReceipts}");
        
        // Check receipts for this branch
        $receipts = Receipt::where('branch_id', $branchId)->count();
        $this->line("Receipts with branch_id = {$branchId}: {$receipts}");
        
        // Check receipts linked to appointments
        $receiptsWithAppointments = Receipt::where('branch_id', $branchId)
            ->whereNotNull('appointment_id')
            ->count();
        $this->line("Receipts with branch_id = {$branchId} AND appointment_id: {$receiptsWithAppointments}");
        
        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('2. SAMPLE DATA (Last 30 days)');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        $startDate = Carbon::now()->subDays(30);
        
        $this->line("Date Range: {$startDate->format('Y-m-d')} to " . Carbon::now()->format('Y-m-d'));
        $this->newLine();
        
        // ALL appointments for this branch (no date filter)
        $allBranchAppointments = Appointment::where('branch_id', $branchId)->get(['id', 'branch_id', 'patient_id', 'appointment_date', 'status']);
        $this->line("ALL appointments with branch_id = {$branchId} (no date filter):");
        if ($allBranchAppointments->count() > 0) {
            foreach ($allBranchAppointments as $apt) {
                $inRange = $apt->appointment_date >= $startDate && $apt->appointment_date <= Carbon::now();
                $this->line("  - ID: {$apt->id}, Patient: {$apt->patient_id}, Date: {$apt->appointment_date->format('Y-m-d')}, Status: {$apt->status}, In Range: " . ($inRange ? 'YES' : 'NO'));
            }
        } else {
            $this->warn("  No appointments found with branch_id = {$branchId}");
        }
        
        // Sample appointments
        $sampleAppointments = Appointment::whereBetween('appointment_date', [
            $startDate->format('Y-m-d'),
            Carbon::now()->format('Y-m-d')
        ])->where('branch_id', $branchId)->limit(5)->get(['id', 'branch_id', 'patient_id', 'appointment_date', 'status']);
        
        $this->newLine();
        $this->line("Appointments with branch_id = {$branchId} IN DATE RANGE:");
        if ($sampleAppointments->count() > 0) {
            foreach ($sampleAppointments as $apt) {
                $this->line("  - ID: {$apt->id}, Patient: {$apt->patient_id}, Date: {$apt->appointment_date->format('Y-m-d')}, Status: {$apt->status}");
            }
        } else {
            $this->warn("  No appointments found in date range");
        }
        
        // Sample appointments via receipts
        $sampleAppointmentsViaReceipts = Appointment::whereBetween('appointment_date', [
            $startDate->format('Y-m-d'),
            Carbon::now()->format('Y-m-d')
        ])->whereHas('receipt', function($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })->limit(5)->get(['id', 'branch_id', 'patient_id', 'appointment_date', 'status']);
        
        $this->newLine();
        $this->line("Sample appointments linked to receipts with branch_id = {$branchId}:");
        if ($sampleAppointmentsViaReceipts->count() > 0) {
            foreach ($sampleAppointmentsViaReceipts as $apt) {
                $this->line("  - ID: {$apt->id}, Branch_ID: " . ($apt->branch_id ?? 'NULL') . ", Patient: {$apt->patient_id}, Date: {$apt->appointment_date}, Status: {$apt->status}");
            }
        } else {
            $this->warn("  No appointments found via receipts");
        }
        
        // Sample receipts
        $sampleReceipts = Receipt::where('branch_id', $branchId)
            ->whereDate('date', '>=', $startDate->format('Y-m-d'))
            ->limit(5)
            ->get(['id', 'branch_id', 'appointment_id', 'date', 'total_due']);
        
        $this->newLine();
        $this->line("Sample receipts with branch_id = {$branchId}:");
        if ($sampleReceipts->count() > 0) {
            foreach ($sampleReceipts as $receipt) {
                $this->line("  - ID: {$receipt->id}, Appointment_ID: " . ($receipt->appointment_id ?? 'NULL') . ", Date: {$receipt->date}, Total: {$receipt->total_due}");
            }
        } else {
            $this->warn("  No receipts found");
        }
        
        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('3. QUERY TEST');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Test the actual query used in analytics (NEW LOGIC - uses receipt date)
        $testQuery = Appointment::where(function($q) use ($startDate, $branchId) {
            // Appointments with branch_id in date range
            $q->whereBetween('appointment_date', [
                $startDate->format('Y-m-d'),
                Carbon::now()->format('Y-m-d')
            ]);
            if ($branchId) {
                $q->where('branch_id', $branchId);
            }
        })->orWhere(function($q) use ($startDate, $branchId) {
            // Appointments linked to receipts with branch_id where receipt date is in range
            if ($branchId) {
                $q->whereHas('receipt', function($q2) use ($startDate, $branchId) {
                    $q2->where('branch_id', $branchId)
                       ->whereBetween('date', [
                           $startDate->format('Y-m-d'),
                           Carbon::now()->format('Y-m-d')
                       ]);
                });
            }
        });
        
        $testCount = $testQuery->count();
        $testPatients = $testQuery->distinct('patient_id')->count('patient_id');
        
        // Show which appointments were found
        $foundAppointments = $testQuery->get(['id', 'branch_id', 'patient_id', 'appointment_date']);
        $this->newLine();
        $this->line("Found Appointments:");
        if ($foundAppointments->count() > 0) {
            foreach ($foundAppointments as $apt) {
                $receipt = \App\Models\Receipt::where('appointment_id', $apt->id)->first();
                $this->line("  - ID: {$apt->id}, Branch_ID: " . ($apt->branch_id ?? 'NULL') . ", Patient: {$apt->patient_id}, Appointment Date: {$apt->appointment_date->format('Y-m-d')}, Receipt Date: " . ($receipt ? $receipt->date->format('Y-m-d') : 'N/A'));
            }
        } else {
            $this->warn("  No appointments found");
        }
        
        $this->line("Test Query Results (Last 30 days):");
        $this->line("  Total Appointments: {$testCount}");
        $this->line("  Unique Patients: {$testPatients}");
        
        $this->newLine();
        $this->info('✅ Diagnosis complete!');
        
        return 0;
    }
}

