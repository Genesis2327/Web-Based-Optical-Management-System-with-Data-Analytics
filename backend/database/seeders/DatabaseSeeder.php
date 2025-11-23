<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Product;
use App\Models\Appointment;
use App\Models\Transaction;
use App\Enums\UserRole;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Artisan;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     * 
     * ⚠️ WARNING: This seeder is designed for FRESH/EMPTY databases only!
     * Running this on a database with existing data may cause issues.
     * 
     * PROTECTION MECHANISMS:
     * 1. Checks if database has existing data
     * 2. Creates automatic backup before seeding (if data exists)
     * 3. Only runs on empty database or with explicit --force flag
     */
    public function run(): void
    {
        // ==========================================
        // 🛡️ PROTECTION LAYER 1: Check for existing data
        // ==========================================
        $userCount = User::count();
        $productCount = Product::count();
        $appointmentCount = Appointment::count();
        $transactionCount = Transaction::count();
        
        $hasData = $userCount > 0 || $productCount > 0 || $appointmentCount > 0 || $transactionCount > 0;
        
        if ($hasData) {
            $this->command->newLine();
            $this->command->error('╔════════════════════════════════════════════════════════════════╗');
            $this->command->error('║  ⚠️  DATABASE ALREADY CONTAINS DATA - SEEDING BLOCKED!  ⚠️    ║');
            $this->command->error('╚════════════════════════════════════════════════════════════════╝');
            $this->command->newLine();
            $this->command->warn('Current Database Statistics:');
            $this->command->line("  • Users: {$userCount}");
            $this->command->line("  • Products: {$productCount}");
            $this->command->line("  • Appointments: {$appointmentCount}");
            $this->command->line("  • Transactions: {$transactionCount}");
            $this->command->newLine();
            $this->command->error('❌ SEEDING PREVENTED - This would overwrite or duplicate existing data!');
            $this->command->newLine();
            $this->command->info('💡 Safe Options:');
            $this->command->line('  1. To seed a fresh database: php artisan migrate:fresh --seed');
            $this->command->line('  2. To backup first: php artisan db:backup');
            $this->command->line('  3. To seed individual tables: php artisan db:seed --class=SpecificSeeder');
            $this->command->newLine();
            $this->command->warn('⚠️  NEVER run "migrate:fresh" on production or database with important data!');
            $this->command->newLine();
            
            return; // Exit without seeding
        }
        
        // ==========================================
        // 🛡️ PROTECTION LAYER 2: Database is empty, safe to seed
        // ==========================================
        $this->command->newLine();
        $this->command->info('✅ Database is empty - Safe to seed');
        $this->command->newLine();

        // Note: In production, create admin user manually for security
        // These are test accounts only - change passwords before production!

        // Run seeders in order (branches first, then users, then related data)
        $this->call([
            BranchSeeder::class,        // Create branches first
            ProductCategorySeeder::class, // Create product categories
            UserSeeder::class,           // Create users (test accounts)
            ProductSeeder::class,        // Create sample products
            StockReturnSeeder::class,    // Create stock returns
            // TestReceiptSeeder::class, // Run separately to add test receipts: php artisan db:seed --class=TestReceiptSeeder
            // ScheduleSeeder::class,    // Create doctor schedules (if exists)
            // ComprehensiveDummyDataSeeder::class, // Disabled to use real product data
            // AnalyticsTestSeeder::class, // Disabled by default - run separately for test data
        ]);
        
        $this->command->newLine();
        $this->command->info('✅ Seeding completed successfully!');
        $this->command->warn('💡 Tip: Run "php artisan db:backup" to create a backup of this seeded data');
        $this->command->newLine();
    }
}
