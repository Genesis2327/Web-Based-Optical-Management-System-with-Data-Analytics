<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Prescription;
use App\Models\User;

class RemovePrescriptionsForAlmerJann extends Command
{
    protected $signature = 'prescriptions:remove-for-almer-jann {--confirm : Skip confirmation prompt}';

    protected $description = 'Remove prescriptions for Almer Jann that are NOT prescribed by Samuel Loreto Prieto';

    public function handle()
    {
        $this->newLine();
        $this->warn('🗑️  Remove Prescriptions for Almer Jann');
        $this->line('This will delete all prescriptions for Almer Jann that are NOT prescribed by Samuel Loreto Prieto.');
        $this->newLine();

        // Find the customer "Almer Jann"
        $customer = User::where('name', 'like', '%almer jann%')
            ->orWhere('name', 'like', '%Almer Jann%')
            ->where('role', 'customer')
            ->first();

        if (!$customer) {
            $this->error('❌ Customer "Almer Jann" not found.');
            return 1;
        }

        $this->info("✅ Found customer: {$customer->name} (ID: {$customer->id})");

        // Find the optometrist "Samuel Loreto Prieto"
        $optometrist = User::where('name', 'like', '%Samuel Loreto Prieto%')
            ->orWhere('name', 'like', '%samuel loreto prieto%')
            ->where('role', 'optometrist')
            ->first();

        if (!$optometrist) {
            $this->error('❌ Optometrist "Samuel Loreto Prieto" not found.');
            return 1;
        }

        $this->info("✅ Found optometrist: {$optometrist->name} (ID: {$optometrist->id})");

        // Find all prescriptions for Almer Jann
        $allPrescriptions = Prescription::where('patient_id', $customer->id)
            ->with(['optometrist'])
            ->get();

        $this->newLine();
        $this->info("📊 Total prescriptions for Almer Jann: {$allPrescriptions->count()}");

        // Filter prescriptions NOT prescribed by Samuel Loreto Prieto
        $prescriptionsToDelete = $allPrescriptions->filter(function ($prescription) use ($optometrist) {
            return $prescription->optometrist_id !== $optometrist->id;
        });

        if ($prescriptionsToDelete->count() === 0) {
            $this->info('✅ No prescriptions to delete. All prescriptions are by Samuel Loreto Prieto.');
            return 0;
        }

        $this->warn("⚠️  Found {$prescriptionsToDelete->count()} prescription(s) to delete:");
        $this->newLine();

        $tableData = [];
        foreach ($prescriptionsToDelete as $prescription) {
            $optometristName = $prescription->optometrist ? $prescription->optometrist->name : 'Unknown';
            $tableData[] = [
                $prescription->id,
                $prescription->prescription_number ?: 'N/A',
                $optometristName,
                $prescription->issue_date ? $prescription->issue_date->format('Y-m-d') : 'N/A',
                $prescription->type ?: 'N/A',
            ];
        }

        $this->table(
            ['ID', 'Prescription Number', 'Optometrist', 'Issue Date', 'Type'],
            $tableData
        );

        $this->newLine();

        if (!$this->option('confirm')) {
            if (!$this->confirm('Are you sure you want to delete these prescriptions?', false)) {
                $this->info('Operation cancelled.');
                return 0;
            }
        }

        $this->newLine();
        $this->info('🗑️  Deleting prescriptions...');

        $deleted = 0;
        foreach ($prescriptionsToDelete as $prescription) {
            try {
                $prescription->delete(); // Soft delete
                $deleted++;
                $optometristName = $prescription->optometrist ? $prescription->optometrist->name : 'Unknown';
                $this->line("  ✅ Deleted prescription #{$prescription->id} (prescribed by: {$optometristName})");
            } catch (\Exception $e) {
                $this->error("  ❌ Failed to delete prescription #{$prescription->id}: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info("✅ Successfully deleted {$deleted} prescription(s).");
        $this->info("📊 Remaining prescriptions for Almer Jann: " . ($allPrescriptions->count() - $deleted));

        return 0;
    }
}

