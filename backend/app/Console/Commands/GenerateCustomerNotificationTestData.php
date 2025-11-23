<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Branch;
use App\Models\Appointment;
use App\Models\Prescription;
use App\Models\Reservation;
use App\Models\Transaction;
use App\Models\Receipt;
use App\Models\EyewearReminder;
use App\Models\Notification;
use App\Models\ProductAvailabilityNotification;
use App\Models\BranchStock;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class GenerateCustomerNotificationTestData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:generate-notification-data 
                            {--customer-email=test.customer@example.com : Email for test customer}
                            {--clean : Clean existing test data first}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate mock data to test customer notification and tracking features';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🚀 Generating Customer Notification Test Data...');
        $this->newLine();

        // Clean existing test data if requested
        if ($this->option('clean')) {
            $this->info('🧹 Cleaning existing test data...');
            $this->cleanTestData();
        }

        try {
            DB::beginTransaction();

            // Check if required tables exist
            $this->checkRequiredTables();

            // 1. Create or get test customer
            $customer = $this->createTestCustomer();
            $this->info("✅ Created/Found test customer: {$customer->name} (ID: {$customer->id})");

            // 2. Get or create branches
            $branch = $this->getOrCreateBranch();
            $this->info("✅ Using branch: {$branch->name}");

            // 3. Get or create product categories
            $frameCategory = $this->getOrCreateCategory('Frames', 'frames');
            $lensCategory = $this->getOrCreateCategory('Contact Lenses', 'contact-lenses');
            $this->info("✅ Product categories ready");

            // 4. Create test products
            $frameProduct = $this->createTestProduct('Test Eyeglass Frame', $frameCategory->id, 1500.00);
            $lensProduct = $this->createTestProduct('Test Prescription Lens', $lensCategory->id, 2000.00);
            $outOfStockProduct = $this->createTestProduct('Out of Stock Frame', $frameCategory->id, 1800.00);
            $this->info("✅ Created test products");

            // 5. Create branch stock
            $this->createBranchStock($branch->id, $frameProduct->id, 10);
            $this->createBranchStock($branch->id, $lensProduct->id, 5);
            $this->createBranchStock($branch->id, $outOfStockProduct->id, 0); // Out of stock
            $this->info("✅ Created branch stock");

            // 6. Create product availability notification (pending)
            $this->createProductAvailabilityNotification($customer->id, $outOfStockProduct->id, $branch->id);
            $this->info("✅ Created product availability notification (pending)");

            // 7. Create eyewear reminders (different scenarios)
            $this->createEyewearReminders($customer, $frameProduct, $lensProduct, $branch);
            $this->info("✅ Created eyewear reminders");

            // 8. Create notifications (various types)
            $this->createNotifications($customer, $frameProduct, $branch);
            $this->info("✅ Created sample notifications");

            // 9. Create appointments and prescriptions
            $appointment = $this->createAppointment($customer, $branch);
            $prescription = $this->createPrescription($customer, $appointment, $branch);
            $this->info("✅ Created appointment and prescription");

            // 10. Create transaction with reminder
            $this->createTransactionWithReminder($customer, $frameProduct, $appointment, $branch);
            $this->info("✅ Created transaction with auto-reminder");

            // 11. Create follow-up appointment
            $followUpAppointment = $this->createFollowUpAppointment($customer, $branch);
            $this->info("✅ Created follow-up appointment with notification");

            // 12. Create eye grade change scenario
            $this->createEyeGradeChangeScenario($customer, $branch);
            $this->info("✅ Created eye grade change scenario");

            DB::commit();

            $this->newLine();
            $this->info('✨ Test data generation completed successfully!');
            $this->newLine();
            
            $this->displaySummary($customer);

            return Command::SUCCESS;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('❌ Error generating test data: ' . $e->getMessage());
            $this->error('Stack trace: ' . $e->getTraceAsString());
            return Command::FAILURE;
        }
    }

    private function createTestCustomer()
    {
        $email = $this->option('customer-email');
        
        return User::firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Test Customer',
                'password' => bcrypt('password'),
                'role' => 'customer',
                'phone' => '09123456789',
                'email_verified_at' => now(),
            ]
        );
    }

    private function getOrCreateBranch()
    {
        return Branch::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Branch',
                'address' => '123 Test Street',
                'phone' => '02-1234-5678',
                'is_active' => true,
            ]
        );
    }

    private function getOrCreateCategory($name, $slug)
    {
        return ProductCategory::firstOrCreate(
            ['slug' => $slug],
            [
                'name' => $name,
                'description' => "Test {$name} category",
                'is_active' => true,
                'sort_order' => 1,
            ]
        );
    }

    private function createTestProduct($name, $categoryId, $price)
    {
        return Product::create([
            'name' => $name,
            'description' => "Test product: {$name}",
            'price' => $price,
            'category_id' => $categoryId,
            'is_active' => true,
            'approval_status' => 'approved',
            'stock_quantity' => 0, // Managed by branch_stock
        ]);
    }

    private function createBranchStock($branchId, $productId, $quantity)
    {
        BranchStock::updateOrCreate(
            [
                'branch_id' => $branchId,
                'product_id' => $productId,
            ],
            [
                'stock_quantity' => $quantity,
                'reserved_quantity' => 0,
                'min_stock_threshold' => 5,
            ]
        );
    }

    private function createProductAvailabilityNotification($customerId, $productId, $branchId)
    {
        ProductAvailabilityNotification::firstOrCreate(
            [
                'patient_id' => $customerId,
                'product_id' => $productId,
            ],
            [
                'branch_id' => $branchId,
                'status' => 'pending',
            ]
        );
    }

    private function createEyewearReminders($customer, $frameProduct, $lensProduct, $branch)
    {
        // Reminder 1: Frame - Due today (for testing)
        EyewearReminder::create([
            'user_id' => $customer->id,
            'product_id' => $frameProduct->id,
            'product_type' => 'frame',
            'reminder_type' => 'condition_check',
            'reminder_interval_days' => 90,
            'purchase_date' => Carbon::now()->subDays(90),
            'next_reminder_date' => Carbon::today(), // Due today
            'is_active' => true,
            'is_dismissed' => false,
        ]);

        // Reminder 2: Prescription Lens - Due in 30 days
        EyewearReminder::create([
            'user_id' => $customer->id,
            'product_id' => $lensProduct->id,
            'product_type' => 'prescription_lens',
            'reminder_type' => 'condition_check',
            'reminder_interval_days' => 180,
            'purchase_date' => Carbon::now()->subDays(150),
            'next_reminder_date' => Carbon::now()->addDays(30),
            'is_active' => true,
            'is_dismissed' => false,
        ]);

        // Reminder 3: Overdue reminder
        EyewearReminder::create([
            'user_id' => $customer->id,
            'product_id' => $frameProduct->id,
            'product_type' => 'frame',
            'reminder_type' => 'condition_check',
            'reminder_interval_days' => 90,
            'purchase_date' => Carbon::now()->subDays(120),
            'next_reminder_date' => Carbon::now()->subDays(5), // Overdue
            'is_active' => true,
            'is_dismissed' => false,
        ]);
    }

    private function createNotifications($customer, $product, $branch)
    {
        // Product availability notification
        Notification::create([
            'user_id' => $customer->id,
            'role' => 'customer',
            'title' => 'Product Available',
            'message' => "Great news! {$product->name} is now available. Visit us to see it in person!",
            'type' => 'product_availability',
            'status' => 'unread',
            'data' => [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'branch_id' => $branch->id,
            ],
        ]);

        // Eyewear reminder notification
        Notification::create([
            'user_id' => $customer->id,
            'role' => 'customer',
            'title' => 'Eyewear Condition Check Reminder',
            'message' => "It's time for a condition check on your eyewear frames. Please inspect your eyewear frames for any scratches, damage, or issues. You can submit a quick feedback form to let us know about the condition of your eyewear.\n\nPlease fill out the feedback form to help us track your eyewear condition.",
            'type' => 'eyewear_reminder',
            'status' => 'unread',
            'data' => [
                'reminder_id' => 1,
                'product_type' => 'frame',
                'product_id' => $product->id,
            ],
        ]);

        // Eye grade change notification
        Notification::create([
            'user_id' => $customer->id,
            'role' => 'customer',
            'title' => 'Prescription Updated',
            'message' => 'Your eye grade has been updated. Please review the changes. We recommend reviewing your current eyewear products as they may need updating.',
            'type' => 'eye_grade_change',
            'status' => 'unread',
            'data' => [
                'prescription_id' => 1,
                'has_active_products' => true,
                'changes' => [
                    'right_eye' => [
                        'sphere' => ['old' => '-2.00', 'new' => '-2.50'],
                        'cylinder' => ['old' => '-0.50', 'new' => '-0.75'],
                    ],
                ],
            ],
        ]);
    }

    private function createAppointment($customer, $branch)
    {
        // Get or create an optometrist
        $optometrist = User::where('role', 'optometrist')->first();
        
        if (!$optometrist) {
            $optometrist = User::create([
                'name' => 'Dr. Test Optometrist',
                'email' => 'optometrist@test.com',
                'password' => bcrypt('password'),
                'role' => 'optometrist',
                'email_verified_at' => now(),
            ]);
        }

        return Appointment::create([
            'patient_id' => $customer->id,
            'optometrist_id' => $optometrist->id,
            'branch_id' => $branch->id,
            'appointment_date' => Carbon::now()->subDays(7)->toDateString(),
            'start_time' => '10:00',
            'end_time' => '11:00',
            'type' => 'eye_exam',
            'status' => 'completed',
        ]);
    }

    private function createPrescription($customer, $appointment, $branch)
    {
        return Prescription::create([
            'patient_id' => $customer->id,
            'appointment_id' => $appointment->id,
            'optometrist_id' => $appointment->optometrist_id,
            'branch_id' => $branch->id,
            'issue_date' => $appointment->appointment_date,
            'expiry_date' => Carbon::parse($appointment->appointment_date)->addYears(2),
            'status' => 'active',
            'right_eye' => [
                'sphere' => '-2.00',
                'cylinder' => '-0.50',
                'axis' => '180',
                'pd' => '62',
            ],
            'left_eye' => [
                'sphere' => '-1.75',
                'cylinder' => '-0.25',
                'axis' => '180',
                'pd' => '62',
            ],
        ]);
    }

    private function createTransactionWithReminder($customer, $product, $appointment, $branch)
    {
        // Create reservation
        $reservation = Reservation::create([
            'user_id' => $customer->id,
            'product_id' => $product->id,
            'branch_id' => $branch->id,
            'quantity' => 1,
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        // Create transaction
        $transaction = Transaction::create([
            'customer_id' => $customer->id,
            'branch_id' => $branch->id,
            'appointment_id' => $appointment->id,
            'reservation_id' => $reservation->id,
            'total_amount' => $product->price,
            'status' => 'Completed',
            'payment_method' => 'Cash',
            'completed_at' => now(),
        ]);

        // Create receipt
        $receipt = Receipt::create([
            'customer_id' => $customer->id,
            'branch_id' => $branch->id,
            'reservation_id' => $reservation->id,
            'appointment_id' => $appointment->id,
            'sales_type' => 'retail',
            'date' => now()->toDateString(),
            'customer_name' => $customer->name,
            'total_due' => $product->price,
            'vatable_sales' => $product->price,
            'vat_amount' => $product->price * 0.12,
        ]);

        // Manually trigger reminder creation (simulating TransactionController)
        $this->createReminderFromTransaction($customer, $product, $reservation, $transaction);

        return $transaction;
    }

    private function createReminderFromTransaction($customer, $product, $reservation, $transaction)
    {
        // Determine product type
        $productType = 'frame'; // Default, can be enhanced
        
        if ($product->category) {
            $categoryName = strtolower($product->category->name ?? '');
            if (str_contains($categoryName, 'contact')) {
                $productType = 'contact_lens';
            } elseif (str_contains($categoryName, 'lens')) {
                $productType = 'prescription_lens';
            }
        }

        $intervalDays = match($productType) {
            'frame' => 90,
            'prescription_lens' => 180,
            'contact_lens' => 30,
            default => 90
        };

        EyewearReminder::create([
            'user_id' => $customer->id,
            'product_id' => $product->id,
            'reservation_id' => $reservation->id,
            'transaction_id' => $transaction->id,
            'product_type' => $productType,
            'reminder_type' => 'condition_check',
            'reminder_interval_days' => $intervalDays,
            'purchase_date' => now(),
            'next_reminder_date' => Carbon::now()->addDays($intervalDays),
            'is_active' => true,
        ]);
    }

    private function createFollowUpAppointment($customer, $branch)
    {
        $optometrist = User::where('role', 'optometrist')->first();
        
        $appointment = Appointment::create([
            'patient_id' => $customer->id,
            'optometrist_id' => $optometrist?->id,
            'branch_id' => $branch->id,
            'appointment_date' => Carbon::now()->addDays(30)->toDateString(),
            'start_time' => '14:00',
            'end_time' => '15:00',
            'type' => 'follow_up',
            'status' => 'scheduled',
        ]);

        // Create follow-up notification
        Notification::create([
            'user_id' => $customer->id,
            'role' => 'customer',
            'title' => 'Follow-up Appointment Scheduled',
            'message' => "Your follow-up appointment has been scheduled for {$appointment->appointment_date} at {$appointment->start_time} at {$branch->name}",
            'type' => 'follow_up',
            'status' => 'unread',
            'data' => [
                'appointment_id' => $appointment->id,
                'appointment_date' => $appointment->appointment_date,
                'start_time' => $appointment->start_time,
                'branch_id' => $branch->id,
            ],
        ]);

        return $appointment;
    }

    private function createEyeGradeChangeScenario($customer, $branch)
    {
        $optometrist = User::where('role', 'optometrist')->first();
        
        // Create old prescription
        $oldPrescription = Prescription::create([
            'patient_id' => $customer->id,
            'optometrist_id' => $optometrist?->id,
            'branch_id' => $branch->id,
            'issue_date' => Carbon::now()->subMonths(6)->toDateString(),
            'expiry_date' => Carbon::now()->addMonths(18)->toDateString(),
            'status' => 'active',
            'right_eye' => [
                'sphere' => '-2.00',
                'cylinder' => '-0.50',
                'axis' => '180',
            ],
            'left_eye' => [
                'sphere' => '-1.75',
                'cylinder' => '-0.25',
                'axis' => '180',
            ],
        ]);

        // Create new prescription with changes
        $newPrescription = Prescription::create([
            'patient_id' => $customer->id,
            'optometrist_id' => $optometrist?->id,
            'branch_id' => $branch->id,
            'issue_date' => Carbon::now()->toDateString(),
            'expiry_date' => Carbon::now()->addYears(2)->toDateString(),
            'status' => 'active',
            'right_eye' => [
                'sphere' => '-2.50', // Changed
                'cylinder' => '-0.75', // Changed
                'axis' => '180',
            ],
            'left_eye' => [
                'sphere' => '-2.00', // Changed
                'cylinder' => '-0.50', // Changed
                'axis' => '180',
            ],
        ]);

        // The eye grade change notification should be created automatically
        // when prescription is created via PrescriptionController
        // But we'll create it manually here for testing
        Notification::create([
            'user_id' => $customer->id,
            'role' => 'customer',
            'title' => 'Prescription Updated',
            'message' => 'Your eye grade has been updated. Please review the changes. We recommend reviewing your current eyewear products as they may need updating.',
            'type' => 'eye_grade_change',
            'status' => 'unread',
            'data' => [
                'prescription_id' => $newPrescription->id,
                'previous_prescription_id' => $oldPrescription->id,
                'has_active_products' => true,
                'changes' => [
                    'right_eye' => [
                        'sphere' => ['old' => '-2.00', 'new' => '-2.50'],
                        'cylinder' => ['old' => '-0.50', 'new' => '-0.75'],
                    ],
                    'left_eye' => [
                        'sphere' => ['old' => '-1.75', 'new' => '-2.00'],
                        'cylinder' => ['old' => '-0.25', 'new' => '-0.50'],
                    ],
                ],
            ],
        ]);
    }

    private function cleanTestData()
    {
        $email = $this->option('customer-email');
        $customer = User::where('email', $email)->first();

        if ($customer) {
            // Delete related data
            EyewearReminder::where('user_id', $customer->id)->delete();
            Notification::where('user_id', $customer->id)->delete();
            ProductAvailabilityNotification::where('patient_id', $customer->id)->delete();
            Reservation::where('user_id', $customer->id)->delete();
            Transaction::where('customer_id', $customer->id)->delete();
            Appointment::where('patient_id', $customer->id)->delete();
            Prescription::where('patient_id', $customer->id)->delete();
            
            $this->info("   Cleaned data for customer: {$customer->email}");
        }
    }

    private function checkRequiredTables()
    {
        $requiredTables = [
            'users',
            'products',
            'product_categories',
            'branches',
            'appointments',
            'prescriptions',
            'reservations',
            'transactions',
            'receipts',
            'eyewear_reminders',
            'notifications',
            'branch_stock',
        ];

        $missingTables = [];
        foreach ($requiredTables as $table) {
            if (!Schema::hasTable($table)) {
                $missingTables[] = $table;
            }
        }

        if (!empty($missingTables)) {
            $this->error('❌ Missing required database tables:');
            foreach ($missingTables as $table) {
                $this->error("   - {$table}");
            }
            $this->newLine();
            $this->info('💡 Please run migrations first:');
            $this->line('   php artisan migrate');
            throw new \Exception('Missing required database tables. Please run migrations.');
        }
    }

    private function displaySummary($customer)
    {
        $this->info('📊 Generated Data Summary:');
        $this->newLine();
        
        $remindersCount = EyewearReminder::where('user_id', $customer->id)->count();
        $notificationsCount = Notification::where('user_id', $customer->id)->count();
        $dueRemindersCount = EyewearReminder::where('user_id', $customer->id)
            ->where('next_reminder_date', '<=', Carbon::today())
            ->where('is_active', true)
            ->where('is_dismissed', false)
            ->count();

        $this->table(
            ['Metric', 'Count'],
            [
                ['Eyewear Reminders', $remindersCount],
                ['Notifications', $notificationsCount],
                ['Due Reminders', $dueRemindersCount],
            ]
        );

        $this->newLine();
        $this->info('🔑 Login Credentials:');
        $this->line("   Email: {$customer->email}");
        $this->line("   Password: password");
        $this->newLine();

        $this->info('📝 What to Check in Frontend:');
        $this->line('   1. Log in as the test customer');
        $this->line('   2. Check Notification Center - you should see:');
        $this->line('      - Product availability notification');
        $this->line('      - Eyewear reminder notification');
        $this->line('      - Eye grade change notification');
        $this->line('      - Follow-up appointment notification');
        $this->line('   3. Check Eyewear Reminders section - you should see:');
        $this->line('      - Reminders with different due dates');
        $this->line('      - One reminder due today');
        $this->line('      - One overdue reminder');
        $this->line('   4. Test feedback form from a due reminder');
        $this->newLine();

        $this->info('🧪 Test Commands:');
        $this->line('   - Run reminder notifications: php artisan eyewear:send-reminders');
        $this->line('   - Clean test data: php artisan test:generate-notification-data --clean');
        $this->newLine();
    }
}

