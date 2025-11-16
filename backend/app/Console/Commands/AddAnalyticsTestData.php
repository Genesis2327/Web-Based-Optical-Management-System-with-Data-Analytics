<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;
use App\Models\User;
use App\Models\Appointment;
use App\Models\Receipt;
use App\Models\ReceiptItem;
use App\Models\Feedback;
use App\Models\Prescription;
use App\Models\Product;
use App\Models\Branch;
use App\Models\Reservation;
use App\Models\BranchStock;
use App\Enums\UserRole;

class AddAnalyticsTestData extends Command
{
    protected $signature = 'analytics:add-test 
                            {--count=10 : Number of records to add per type}
                            {--days=7 : Number of days to spread data across}
                            {--today : Add data for today only}
                            {--patients=5 : Number of test patients to create}';

    protected $description = 'Add a small batch of dummy analytics test data (safe to run multiple times)';

    public function handle()
    {
        $count = (int) $this->option('count');
        $days = (int) $this->option('days');
        $todayOnly = $this->option('today');
        $patientCount = (int) $this->option('patients');

        $this->newLine();
        $this->info('📊 Adding Analytics Test Data for Graphs');
        $this->line("📈 Data will be distributed across dates for time-series charts");
        $this->line("Count per type: {$count}");
        $this->line("Date range: " . ($todayOnly ? 'Today only' : "Last {$days} days"));
        $this->newLine();

        // Get existing data for relationships
        $branches = Branch::where('is_active', true)->get();
        $customers = User::where('role', UserRole::CUSTOMER)->where('is_approved', true)->get();
        $optometrists = User::where('role', UserRole::OPTOMETRIST)->where('is_approved', true)->get();
        $products = Product::where('is_active', true)->get();

        if ($branches->isEmpty() || $customers->isEmpty() || $optometrists->isEmpty() || $products->isEmpty()) {
            $this->error('❌ Insufficient base data. Please ensure you have:');
            $this->error('  • Active branches');
            $this->error('  • Approved customers');
            $this->error('  • Approved optometrists');
            $this->error('  • Active products');
            return 1;
        }

        // Set date range
        $endDate = Carbon::today();
        $startDate = $todayOnly ? Carbon::today() : Carbon::today()->subDays($days - 1);

        $this->info("📅 Date range: {$startDate->format('Y-m-d')} to {$endDate->format('Y-m-d')}");
        $this->newLine();

        // Create test patients first
        $testPatients = $this->addTestPatients($patientCount, $branches);
        
        // Merge test patients with existing customers
        $allCustomers = $customers->merge($testPatients);

        // Add data
        $appointments = $this->addAppointments($count, $startDate, $endDate, $branches, $allCustomers, $optometrists);
        $prescriptions = $this->addPrescriptions($appointments);
        $receipts = $this->addReceipts($appointments, $branches, $allCustomers, $products);
        $reservations = $this->addReservations($count, $startDate, $endDate, $branches, $allCustomers, $products);
        $feedback = $this->addFeedback($appointments);

        $this->newLine();
        $this->info('✅ Test data added successfully!');
        $this->newLine();
        $this->table(
            ['Type', 'Count'],
            [
                ['Test Patients', $testPatients->count()],
                ['Appointments', $appointments->count()],
                ['Prescriptions', $prescriptions],
                ['Receipts', $receipts],
                ['Reservations', $reservations],
                ['Feedback', $feedback],
            ]
        );

        return 0;
    }

    private function addTestPatients($count, $branches)
    {
        $this->info('👥 Creating test patients...');
        $patients = collect();
        
        $firstNames = [
            'Juan', 'Maria', 'Jose', 'Anna', 'Carlos', 'Rosa', 'Pedro', 'Carmen',
            'Luis', 'Elena', 'Miguel', 'Sofia', 'Antonio', 'Isabel', 'Francisco',
            'Patricia', 'Manuel', 'Lucia', 'David', 'Eva', 'Javier', 'Ana',
            'Fernando', 'Laura', 'Roberto', 'Monica', 'Ricardo', 'Andrea'
        ];
        
        $lastNames = [
            'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Rodriguez',
            'Martinez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez',
            'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Morales', 'Ramos'
        ];

        $existingEmails = User::pluck('email')->toArray();

        for ($i = 0; $i < $count; $i++) {
            // Generate unique email
            $email = '';
            $attempts = 0;
            do {
                $firstName = $firstNames[array_rand($firstNames)];
                $lastName = $lastNames[array_rand($lastNames)];
                $randomNum = rand(1000, 9999);
                $email = strtolower($firstName . '.' . $lastName . $randomNum . '@testpatient.com');
                $attempts++;
            } while (in_array($email, $existingEmails) && $attempts < 100);

            // Assign random branch
            $branch = $branches->random();

            $patientData = [
                'name' => $firstName . ' ' . $lastName,
                'email' => $email,
                'password' => Hash::make('password123'), // Default test password
                'role' => UserRole::CUSTOMER,
                'branch_id' => $branch->id,
                'is_approved' => true,
                'email_verified_at' => now(),
            ];

            // Only add optional fields if columns exist in database
            if (Schema::hasColumn('users', 'phone')) {
                $patientData['phone'] = '09' . rand(100000000, 999999999);
            }
            if (Schema::hasColumn('users', 'address')) {
                $patientData['address'] = $this->generateAddress();
            }
            if (Schema::hasColumn('users', 'date_of_birth')) {
                $patientData['date_of_birth'] = Carbon::now()->subYears(rand(18, 75))->subDays(rand(0, 365))->format('Y-m-d');
            }

            $patient = User::create($patientData);

            $patients->push($patient);
            $existingEmails[] = $email;
        }

        $this->line("  ✅ Created {$patients->count()} test patients");
        $this->line("  📧 Test password for all patients: password123");
        
        return $patients;
    }

    private function generateAddress()
    {
        $streets = ['Main Street', 'Oak Avenue', 'Pine Road', 'Elm Street', 'Maple Drive', 'Cedar Lane'];
        $cities = ['Manila', 'Quezon City', 'Makati', 'Taguig', 'Pasig', 'Mandaluyong', 'San Juan'];
        
        $streetNum = rand(100, 999);
        $street = $streets[array_rand($streets)];
        $city = $cities[array_rand($cities)];
        
        return "{$streetNum} {$street}, {$city}";
    }

    private function addAppointments($count, $startDate, $endDate, $branches, $customers, $optometrists)
    {
        $this->info('📅 Adding appointments (distributed across dates for charts)...');
        $appointments = collect();
        $timeSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

        // Distribute appointments evenly across dates for better time-series visualization
        $daysDiff = $startDate->diffInDays($endDate);
        $appointmentsPerDay = max(1, floor($count / max(1, $daysDiff + 1)));

        $currentDate = $startDate->copy();
        $appointmentsAdded = 0;

        while ($currentDate->lte($endDate) && $appointmentsAdded < $count) {
            // Add appointments for this day
            $todayCount = min($appointmentsPerDay + rand(0, 2), $count - $appointmentsAdded);
            
            for ($i = 0; $i < $todayCount && $appointmentsAdded < $count; $i++) {
                $timeSlot = $timeSlots[array_rand($timeSlots)];
                
                // Weight towards completed status for analytics (60% completed)
                $statuses = ['completed', 'completed', 'completed', 'completed', 'scheduled', 'confirmed', 'cancelled'];
                $types = ['eye_exam', 'contact_fitting', 'follow_up', 'consultation', 'emergency'];
                
                $appointment = Appointment::create([
                    'patient_id' => $customers->random()->id,
                    'optometrist_id' => $optometrists->random()->id,
                    'branch_id' => $branches->random()->id,
                    'appointment_date' => $currentDate->format('Y-m-d'),
                    'start_time' => $timeSlot . ':00',
                    'end_time' => Carbon::parse($timeSlot)->addMinutes(30)->format('H:i:s'),
                    'type' => $types[array_rand($types)],
                    'status' => $statuses[array_rand($statuses)],
                    'notes' => 'Test appointment for analytics graphs',
                    'created_at' => $currentDate->copy()->setTime(rand(8, 17), rand(0, 59)),
                    'updated_at' => Carbon::now(),
                ]);

                $appointments->push($appointment);
                $appointmentsAdded++;
            }
            
            $currentDate->addDay();
        }

        $this->line("  ✅ Added {$appointments->count()} appointments across " . ($daysDiff + 1) . " days");
        return $appointments;
    }

    private function addPrescriptions($appointments)
    {
        $this->info('💊 Adding prescriptions...');
        $count = 0;

        foreach ($appointments->where('status', 'completed') as $appointment) {
            if (rand(1, 100) <= 70) { // 70% chance
                Prescription::create([
                    'appointment_id' => $appointment->id,
                    'patient_id' => $appointment->patient_id,
                    'optometrist_id' => $appointment->optometrist_id,
                    'branch_id' => $appointment->branch_id,
                    'type' => ['glasses', 'contact_lenses', 'sunglasses'][array_rand(['glasses', 'contact_lenses', 'sunglasses'])],
                    'prescription_data' => [
                        'right_eye' => [
                            'sph' => round(rand(-600, 600) / 100, 2),
                            'cyl' => round(rand(-300, -25) / 100, 2),
                            'axis' => rand(1, 180),
                        ],
                        'left_eye' => [
                            'sph' => round(rand(-600, 600) / 100, 2),
                            'cyl' => round(rand(-300, -25) / 100, 2),
                            'axis' => rand(1, 180),
                        ],
                    ],
                    'issue_date' => $appointment->appointment_date,
                    'expiry_date' => Carbon::parse($appointment->appointment_date)->addYear(),
                    'status' => 'active',
                    'notes' => 'Test prescription for analytics',
                    'created_at' => $appointment->created_at,
                    'updated_at' => Carbon::now(),
                ]);
                $count++;
            }
        }

        $this->line("  ✅ Added {$count} prescriptions");
        return $count;
    }

    private function addReceipts($appointments, $branches, $customers, $products)
    {
        $this->info('🧾 Adding receipts with varied revenue for charts...');
        $count = 0;
        $receiptNumber = Receipt::max('id') ?? 0;

        foreach ($appointments->where('status', 'completed') as $appointment) {
            if (rand(1, 100) <= 70) { // 70% chance for completed appointments
                $product = $products->random();
                $quantity = rand(1, 3);
                $productPrice = $product->price * $quantity;
                // Vary exam fees for more interesting revenue charts
                $examFee = rand(500, 2000);
                // Sometimes add multiple products for higher revenue
                if (rand(1, 100) <= 20) {
                    $additionalProduct = $products->where('id', '!=', $product->id)->random();
                    $productPrice += $additionalProduct->price * rand(1, 2);
                }
                $subtotal = $productPrice + $examFee;
                
                $vatableAmount = round($subtotal / 1.12, 2);
                $vatAmount = round($subtotal - $vatableAmount, 2);

                $receipt = Receipt::create([
                    'receipt_number' => 'RCP-' . str_pad(++$receiptNumber, 6, '0', STR_PAD_LEFT),
                    'customer_id' => $appointment->patient_id,
                    'branch_id' => $appointment->branch_id,
                    'appointment_id' => $appointment->id,
                    'sales_type' => 'cash',
                    'date' => $appointment->appointment_date,
                    'customer_name' => $customers->find($appointment->patient_id)->name ?? 'Test Customer',
                    'vatable_sales' => $vatableAmount,
                    'vat_amount' => $vatAmount,
                    'zero_rated_sales' => 0,
                    'vat_exempt_sales' => 0,
                    'net_of_vat' => $vatableAmount,
                    'less_vat' => $vatAmount,
                    'add_vat' => $vatAmount,
                    'discount' => 0,
                    'withholding_tax' => 0,
                    'total_due' => $subtotal,
                    'payment_method' => ['cash', 'card', 'gcash'][array_rand(['cash', 'card', 'gcash'])],
                    'payment_status' => 'paid',
                    'created_at' => $appointment->created_at,
                    'updated_at' => Carbon::now(),
                ]);

                // Add receipt items
                ReceiptItem::create([
                    'receipt_id' => $receipt->id,
                    'description' => $product->name,
                    'qty' => $quantity,
                    'unit_price' => $product->price,
                    'amount' => $productPrice,
                ]);

                ReceiptItem::create([
                    'receipt_id' => $receipt->id,
                    'description' => 'Eye Examination',
                    'qty' => 1,
                    'unit_price' => $examFee,
                    'amount' => $examFee,
                ]);

                $count++;
            }
        }

        $this->line("  ✅ Added {$count} receipts");
        return $count;
    }

    private function addReservations($count, $startDate, $endDate, $branches, $customers, $products)
    {
        $this->info('📋 Adding reservations (distributed for product analytics charts)...');
        $created = 0;

        // Distribute reservations evenly across dates for better charts
        $daysDiff = $startDate->diffInDays($endDate);
        $reservationsPerDay = max(1, floor($count / max(1, $daysDiff + 1)));

        $currentDate = $startDate->copy();

        while ($currentDate->lte($endDate) && $created < $count) {
            $todayCount = min($reservationsPerDay + rand(0, 2), $count - $created);
            
            for ($i = 0; $i < $todayCount && $created < $count; $i++) {
                $product = $products->random();
                $branch = $branches->random();
                $customer = $customers->random();

                // Use 'approved' status (analytics may treat this as completed in some queries)
                // Most reservations should be approved for product sales charts
                $status = rand(1, 100) <= 70 ? 'approved' : 'pending';

                Reservation::create([
                    'user_id' => $customer->id,
                    'product_id' => $product->id,
                    'branch_id' => $branch->id,
                    'quantity' => rand(1, 3), // Vary quantities for better analytics
                    'status' => $status,
                    'notes' => 'Test reservation for analytics graphs',
                    'reserved_at' => $currentDate->copy()->setTime(rand(8, 17), rand(0, 59)),
                    'created_at' => $currentDate->copy()->setTime(rand(8, 17), rand(0, 59)),
                    'updated_at' => Carbon::now(),
                ]);

                $created++;
            }
            
            $currentDate->addDay();
        }

        $this->line("  ✅ Added {$created} reservations across " . ($daysDiff + 1) . " days");
        return $created;
    }

    private function addFeedback($appointments)
    {
        $this->info('💬 Adding feedback...');
        $count = 0;

        foreach ($appointments->where('status', 'completed') as $appointment) {
            if (rand(1, 100) <= 40) { // 40% chance
                Feedback::create([
                    'customer_id' => $appointment->patient_id,
                    'branch_id' => $appointment->branch_id,
                    'appointment_id' => $appointment->id,
                    'rating' => [5, 5, 4, 5, 4][array_rand([5, 5, 4, 5, 4])],
                    'comment' => 'Test feedback for analytics - Great service!',
                    'created_at' => $appointment->created_at->addDays(rand(1, 3)),
                    'updated_at' => Carbon::now(),
                ]);
                $count++;
            }
        }

        $this->line("  ✅ Added {$count} feedback entries");
        return $count;
    }
}

