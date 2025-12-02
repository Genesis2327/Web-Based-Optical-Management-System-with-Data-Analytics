<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\StockReturn;
use App\Models\Product;
use App\Models\Branch;
use App\Models\User;

class StockReturnSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // For development/demo purposes, reset existing stock return data
        // so we don't keep old records that point to deleted products/branches.
        if (config('app.env') !== 'production') {
            StockReturn::truncate();
        }

        // Get products - excluding specifically "Frame 1" through "Frame 9"
        $products = Product::whereNotIn('name', [
            'Frame 1', 'Frame 2', 'Frame 3', 'Frame 4', 'Frame 5', 'Frame 6', 'Frame 7', 'Frame 8', 'Frame 9'
        ])->take(8)->get();
        if ($products->isEmpty()) {
            $this->command->error('No products found. Please run ProductSeeder first.');
            return;
        }

        // Get some branches
        $branches = Branch::take(2)->get();
        if ($branches->isEmpty()) {
            $this->command->error('No branches found. Please run BranchSeeder first.');
            return;
        }

        // Get some users (staff, optometrist, or manager)
        $staffUser = User::whereIn('role', ['staff', 'optometrist', 'manager'])->first() ?? User::first();
        $adminUser = User::where('role', 'admin')->first() ?? User::first();

        if (!$staffUser || !$adminUser) {
            $this->command->error('No users found. Please run UserSeeder first.');
            return;
        }

        // Sample stock returns data - using products that are NOT named "frame 1 - frame 9"
        $stockReturns = [
            [
                'product_id' => 14, // Contact Lense 1
                'branch_id' => 1, // Emerald Branch
                'quantity' => 2,
                'return_type' => 'defective',
                'reason' => 'Defective lens quality detected during quality check',
                'created_by' => 12, // Staff Emerald
                'approved_by' => 1, // Main Admin
                'status' => 'approved',
                'approved_at' => now()->subDays(1),
                'admin_notes' => 'Returned due to manufacturing defect in lens coating.',
                'product_condition' => '{"defect": "lens_coating"}',
            ],
            [
                'product_id' => 15, // Contact Lense 2
                'branch_id' => 1, // Emerald Branch
                'quantity' => 1,
                'return_type' => 'damaged',
                'reason' => 'Customer dissatisfaction with color accuracy',
                'created_by' => 12, // Staff Emerald
                'approved_by' => 1, // Main Admin
                'status' => 'approved',
                'approved_at' => now()->subDays(4),
                'admin_notes' => 'Customer reported color distortion issues.',
            ],
            [
                'product_id' => 77, // CL1 Contact Lens
                'branch_id' => 2, // Unitop Branch
                'quantity' => 3,
                'return_type' => 'expired',
                'reason' => 'Expired batch received',
                'created_by' => 13, // Staff Unitop
                'status' => 'pending',
                'admin_notes' => 'Batch expired during transportation delay.',
            ],
            [
                'product_id' => 16, // Contact Lense 3
                'branch_id' => 2, // Unitop Branch
                'quantity' => 1,
                'return_type' => 'other',
                'reason' => 'Wrong product shipped',
                'created_by' => 13, // Staff Unitop
                'approved_by' => 1, // Main Admin
                'status' => 'rejected',
                'approved_at' => now()->subDays(3),
                'admin_notes' => 'Incorrect model sent instead of ordered item.',
            ],
            [
                'product_id' => 112, // SOLUTION1 Solution
                'branch_id' => 3, // Newstar Branch
                'quantity' => 2,
                'return_type' => 'damaged',
                'reason' => 'Packaging damaged during shipping',
                'created_by' => 14, // Staff Newstar
                'approved_by' => 1, // Main Admin
                'status' => 'processed',
                'approved_at' => now()->subDays(6),
                'admin_notes' => 'Outer packaging compromised but product intact.',
            ],
        ];

        // Create stock returns
        foreach ($stockReturns as $stockReturnData) {
            StockReturn::create($stockReturnData);
        }

        $this->command->info('Successfully seeded ' . count($stockReturns) . ' stock returns!');
    }
}
