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
        // Get some products (preferably eyeglasses or sunglasses)
        $products = Product::take(4)->get();
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

        // Sample stock returns data
        $stockReturns = [
            [
                'product_id' => $products[0]->id,
                'branch_id' => $branches[0]->id,
                'return_type' => 'defective',
                'quantity' => 2,
                'unit_cost' => 1250.00,
                'total_cost' => 2500.00,
                'reason' => 'Frames arrived with cracked nose bridge',
                'return_reference' => 'RET-DEF-001',
                'status' => 'approved',
                'approved_by' => $adminUser->id,
                'approved_at' => now()->subDays(5),
                'product_condition' => '{"damage_type": "cracked_nose_bridge", "damage_severity": "minor", "is_repairable": true}',
                'admin_notes' => 'Approved for return - quality issue confirmed',
                'created_by' => $staffUser->id,
                'created_at' => now()->subDays(7),
            ],
            [
                'product_id' => $products[1]->id,
                'branch_id' => $branches[0]->id,
                'return_type' => 'damaged',
                'quantity' => 1,
                'unit_cost' => 3200.00,
                'total_cost' => 3200.00,
                'reason' => 'Lens scratched during transportation',
                'return_reference' => 'RET-DAM-002',
                'status' => 'approved',
                'approved_by' => $adminUser->id,
                'approved_at' => now()->subDays(3),
                'product_condition' => '{"damage_type": "scratched_lens", "damage_severity": "moderate", "is_repairable": false}',
                'admin_notes' => 'Approved - scratches too deep for repair',
                'created_by' => $staffUser->id,
                'created_at' => now()->subDays(5),
            ],
            [
                'product_id' => $products[2]->id,
                'branch_id' => $branches[1]->id,
                'return_type' => 'expired',
                'quantity' => 3,
                'unit_cost' => 933.33,
                'total_cost' => 2800.00,
                'reason' => 'Products exceeded expiration date',
                'return_reference' => 'RET-EXP-003',
                'status' => 'pending',
                'product_condition' => '{"expiration_date": "2024-12-15", "reason": "passed_expiry_date"}',
                'created_by' => $staffUser->id,
                'created_at' => now()->subDays(2),
            ],
            [
                'product_id' => $products[0]->id,
                'branch_id' => $branches[1]->id,
                'return_type' => 'other',
                'quantity' => 1,
                'unit_cost' => 2500.00,
                'total_cost' => 2500.00,
                'reason' => 'Wrong model received - ordered XXL, received XL',
                'return_reference' => 'RET-OTH-004',
                'status' => 'rejected',
                'approved_by' => $adminUser->id,
                'approved_at' => now()->subDay(),
                'product_condition' => '{"issue_type": "wrong_model", "ordered_size": "XXL", "received_size": "XL"}',
                'admin_notes' => 'Rejected - items are in good condition, seller error not applicable for return',
                'created_by' => $staffUser->id,
                'created_at' => now()->subDays(3),
            ],
            [
                'product_id' => $products[3]->id,
                'branch_id' => $branches[0]->id,
                'return_type' => 'defective',
                'quantity' => 4,
                'unit_cost' => 875.00,
                'total_cost' => 3500.00,
                'reason' => 'Hinges broken on all frames in batch',
                'return_reference' => 'RET-DEF-005',
                'status' => 'processed',
                'approved_by' => $adminUser->id,
                'approved_at' => now()->subDays(10),
                'product_condition' => '{"damage_type": "broken_hinges", "damage_severity": "major", "affects_all_items": true}',
                'admin_notes' => 'Processed return - supplier credited account',
                'created_by' => $staffUser->id,
                'created_at' => now()->subDays(12),
            ],
        ];

        // Create stock returns
        foreach ($stockReturns as $stockReturnData) {
            StockReturn::create($stockReturnData);
        }

        $this->command->info('Successfully seeded ' . count($stockReturns) . ' stock returns!');
    }
}
