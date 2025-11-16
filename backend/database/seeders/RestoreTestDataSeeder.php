<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class RestoreTestDataSeeder extends Seeder
{
    public function run()
    {
        // Disable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        // Clear existing data
        DB::table('prescriptions')->truncate();
        DB::table('appointments')->truncate();
        
        // Re-enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $now = Carbon::now();
        $customer_id = 8; // Genesis
        $optometrist_id = 11; // Dr. Samuel Prieto
        $branch_id = 1; // Assuming first branch

        // Create appointments
        $appointments = [
            [
                'patient_id' => $customer_id,
                'optometrist_id' => $optometrist_id,
                'appointment_date' => $now->copy()->addDays(3)->format('Y-m-d'),
                'start_time' => '09:00:00',
                'end_time' => '10:00:00',
                'type' => 'eye_exam',
                'status' => 'scheduled',
                'notes' => 'Regular eye examination',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'patient_id' => $customer_id,
                'optometrist_id' => $optometrist_id,
                'appointment_date' => $now->copy()->subDays(30)->format('Y-m-d'),
                'start_time' => '14:00:00',
                'end_time' => '15:00:00',
                'type' => 'follow_up',
                'status' => 'completed',
                'notes' => 'Follow-up examination',
                'created_at' => $now->copy()->subDays(30),
                'updated_at' => $now->copy()->subDays(30),
            ],
            [
                'patient_id' => $customer_id,
                'optometrist_id' => $optometrist_id,
                'appointment_date' => $now->copy()->subDays(60)->format('Y-m-d'),
                'start_time' => '10:00:00',
                'end_time' => '11:00:00',
                'type' => 'consultation',
                'status' => 'completed',
                'notes' => 'Initial consultation',
                'created_at' => $now->copy()->subDays(60),
                'updated_at' => $now->copy()->subDays(60),
            ],
        ];

        foreach ($appointments as $appointment) {
            $appointmentId = DB::table('appointments')->insertGetId($appointment);
            echo "Created appointment ID: $appointmentId\n";
        }

        // Get the completed appointment IDs
        $completedAppointments = DB::table('appointments')
            ->where('status', 'completed')
            ->pluck('id')
            ->toArray();

        // Create prescriptions for completed appointments
        if (!empty($completedAppointments)) {
            $prescriptions = [
                [
                    'patient_id' => $customer_id,
                    'optometrist_id' => $optometrist_id,
                    'appointment_id' => $completedAppointments[0] ?? null,
                    'type' => 'glasses',
                    'prescription_data' => json_encode([
                        'prescription_number' => 'RX' . date('Ymd') . '0001',
                        'right_eye' => [
                            'sphere' => -2.00,
                            'cylinder' => -0.50,
                            'axis' => 180,
                            'add' => 0,
                        ],
                        'left_eye' => [
                            'sphere' => -2.25,
                            'cylinder' => -0.75,
                            'axis' => 175,
                            'add' => 0,
                        ],
                        'vision_acuity' => '20/20',
                        'lens_type' => 'Single Vision',
                        'coating' => 'Anti-reflective',
                        'additional_notes' => 'Mild myopia with astigmatism',
                        'recommendations' => 'Wear glasses for distance vision',
                    ]),
                    'issue_date' => $now->copy()->subDays(30)->format('Y-m-d'),
                    'expiry_date' => $now->copy()->addMonths(24)->format('Y-m-d'),
                    'notes' => 'First prescription for eyeglasses',
                    'status' => 'active',
                    'created_at' => $now->copy()->subDays(30),
                    'updated_at' => $now->copy()->subDays(30),
                ],
                [
                    'patient_id' => $customer_id,
                    'optometrist_id' => $optometrist_id,
                    'appointment_id' => $completedAppointments[1] ?? null,
                    'type' => 'contact_lenses',
                    'prescription_data' => json_encode([
                        'prescription_number' => 'RX' . date('Ymd') . '0002',
                        'right_eye' => [
                            'sphere' => -2.00,
                            'cylinder' => 0,
                            'axis' => 0,
                            'base_curve' => 8.6,
                            'diameter' => 14.2,
                        ],
                        'left_eye' => [
                            'sphere' => -2.25,
                            'cylinder' => 0,
                            'axis' => 0,
                            'base_curve' => 8.6,
                            'diameter' => 14.2,
                        ],
                        'vision_acuity' => '20/20',
                        'replacement_schedule' => 'monthly',
                        'additional_notes' => 'Contact lens prescription',
                        'recommendations' => 'Monthly replacement lenses',
                    ]),
                    'issue_date' => $now->copy()->subDays(60)->format('Y-m-d'),
                    'expiry_date' => $now->copy()->addYear()->format('Y-m-d'),
                    'notes' => 'Contact lens fitting completed',
                    'status' => 'active',
                    'created_at' => $now->copy()->subDays(60),
                    'updated_at' => $now->copy()->subDays(60),
                ],
            ];

            foreach ($prescriptions as $prescription) {
                $prescriptionId = DB::table('prescriptions')->insertGetId($prescription);
                echo "Created prescription ID: $prescriptionId\n";
            }
        }

        echo "\n✅ Test data restored successfully!\n";
        echo "- Created " . count($appointments) . " appointments\n";
        echo "- Created " . count($prescriptions) . " prescriptions\n";
    }
}

