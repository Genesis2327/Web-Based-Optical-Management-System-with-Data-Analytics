<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Enums\UserRole;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class CreateAdminUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:create-admin 
                            {--email=admin@everbright.com : Admin email address}
                            {--name=Administrator : Admin name}
                            {--password=admin123 : Admin password}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create an admin user account';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('=== Create Admin User ===');
        $this->newLine();
        
        $email = $this->option('email');
        $name = $this->option('name');
        $password = $this->option('password');
        
        // Check if admin already exists
        $existingAdmin = User::where('email', $email)->first();
        
        if ($existingAdmin) {
            $this->warn("⚠️  Admin user with email '{$email}' already exists!");
            $this->line("   User ID: {$existingAdmin->id}");
            $this->line("   Name: {$existingAdmin->name}");
            $this->line("   Role: {$existingAdmin->role->value}");
            $this->newLine();
            
            if ($this->confirm('Do you want to update the password?', false)) {
                $existingAdmin->password = Hash::make($password);
                $existingAdmin->email_verified_at = now();
                $existingAdmin->save();
                
                $this->info("✅ Password updated successfully!");
                $this->newLine();
                $this->displayCredentials($email, $password);
            } else {
                $this->info('Operation cancelled.');
            }
            
            return 0;
        }
        
        // Create new admin user
        try {
            $userData = [
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'role' => UserRole::ADMIN,
                'is_approved' => true,
                'email_verified_at' => now(),
            ];
            
            // Only add must_change_password if column exists
            if (Schema::hasColumn('users', 'must_change_password')) {
                $userData['must_change_password'] = false;
            }
            
            $admin = User::create($userData);
            
            $this->info("✅ Admin user created successfully!");
            $this->newLine();
            
            $this->displayCredentials($email, $password);
            
            return 0;
            
        } catch (\Exception $e) {
            $this->error("❌ Error creating admin user: " . $e->getMessage());
            return 1;
        }
    }
    
    /**
     * Display login credentials
     */
    private function displayCredentials($email, $password)
    {
        $this->info('=== Login Credentials ===');
        $this->line("Email: {$email}");
        $this->line("Password: {$password}");
        $this->newLine();
        
        $this->warn('⚠️  IMPORTANT: Change the default password after first login!');
        $this->newLine();
        
        $this->info('✅ You can now login with these credentials.');
    }
}

