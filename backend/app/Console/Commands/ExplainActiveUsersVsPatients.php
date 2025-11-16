<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Appointment;
use Carbon\Carbon;
use App\Enums\UserRole;

class ExplainActiveUsersVsPatients extends Command
{
    protected $signature = 'analytics:explain-users-vs-patients';

    protected $description = 'Explain the difference between Active Users and Total Patients';

    public function handle()
    {
        $this->newLine();
        $this->info('📊 Active Users vs Total Patients - Explanation');
        $this->newLine();

        // Get Active Users (from realtime analytics)
        $activeUsers = User::where('updated_at', '>=', Carbon::now()->subDay())->count();
        $totalUsers = User::count();

        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('1️⃣  ACTIVE USERS');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('Definition: All user accounts updated in the last 24 hours');
        $this->line('Calculation: User::where("updated_at", ">=", now()->subDay())->count()');
        $this->line('Includes: ALL roles (Admin, Staff, Optometrist, Customer, etc.)');
        $this->newLine();
        $this->line("Current Active Users: {$activeUsers}");
        $this->line("Total Users in System: {$totalUsers}");
        $this->newLine();

        // Breakdown by role
        $this->line('Breakdown by Role (Active Users):');
        $activeByRole = User::where('updated_at', '>=', Carbon::now()->subDay())
            ->select('role')
            ->get()
            ->groupBy(function($user) {
                return is_object($user->role) ? $user->role->value : $user->role;
            })
            ->map->count();
        
        foreach ($activeByRole as $role => $count) {
            $this->line("  - {$role}: {$count}");
        }

        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('2️⃣  TOTAL PATIENTS');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('Definition: Unique customers who had appointments in the last 30 days');
        $this->line('Calculation: Appointments->pluck("patient_id")->unique()->count()');
        $this->line('Includes: ONLY customers/patients with appointments');
        $this->line('Time Period: Last 30 days (from branch performance analytics)');
        $this->newLine();

        // Get Total Patients (from branch performance)
        $startDate = Carbon::now()->subDays(30);
        $appointments = Appointment::where('appointment_date', '>=', $startDate->format('Y-m-d'))
            ->where('appointment_date', '<=', Carbon::now()->format('Y-m-d'))
            ->get();
        
        $uniquePatients = $appointments->pluck('patient_id')->unique()->count();
        $totalAppointments = $appointments->count();

        $this->line("Appointments in last 30 days: {$totalAppointments}");
        $this->line("Unique Patients (Total Patients): {$uniquePatients}");
        $this->newLine();

        // Total customers in system
        $totalCustomers = User::where('role', UserRole::CUSTOMER)->count();
        $this->line("Total Customers in System: {$totalCustomers}");
        $this->line("Customers WITH appointments (last 30 days): {$uniquePatients}");
        $this->line("Customers WITHOUT appointments (last 30 days): " . ($totalCustomers - $uniquePatients));

        $this->newLine();
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('🔍 KEY DIFFERENCES');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('✅ Active Users:');
        $this->line('   - ALL user roles (admin, staff, optometrist, customer)');
        $this->line('   - Based on account activity (updated_at) in last 24 hours');
        $this->line('   - Includes users who logged in or had profile updates');
        $this->newLine();
        $this->line('✅ Total Patients:');
        $this->line('   - ONLY customers/patients');
        $this->line('   - ONLY those with appointments in last 30 days');
        $this->line('   - Based on unique patient_id from appointments table');
        $this->line('   - Does NOT include staff, admins, or optometrists');
        $this->line('   - Does NOT include customers without appointments');
        $this->newLine();

        $this->info('💡 Why they are different:');
        $this->line('   1. Active Users includes ALL roles, not just patients');
        $this->line('   2. Active Users = 24 hours, Total Patients = 30 days');
        $this->line('   3. Active Users = any account activity, Total Patients = must have appointments');
        $this->line('   4. Active Users can include staff/admins who logged in today');
        $this->line('   5. Total Patients excludes customers who haven\'t booked appointments');
        $this->newLine();

        return 0;
    }
}



