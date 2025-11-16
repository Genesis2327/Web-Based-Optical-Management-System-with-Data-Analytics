<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\BranchStock;

class RecalculateInventoryStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:recalculate-status {--branch-id= : Recalculate for specific branch only}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate inventory status for all branch stock items based on available quantity and thresholds';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $branchId = $this->option('branch-id');
        
        $query = BranchStock::with(['product', 'branch']);
        
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }
        
        $items = $query->get();
        $this->info("Processing {$items->count()} inventory items...");
        
        $bar = $this->output->createProgressBar($items->count());
        $bar->start();
        
        $stats = [
            'in_stock' => 0,
            'low_stock' => 0,
            'out_of_stock' => 0,
            'updated' => 0,
        ];
        
        foreach ($items as $item) {
            $oldStatus = $item->status;
            
            // Ensure threshold is set
            if ($item->min_stock_threshold === null) {
                $item->min_stock_threshold = 5;
                $item->saveQuietly();
            }
            
            // Recalculate status
            $item->updateStatus();
            $item->refresh();
            
            $newStatus = $item->status;
            
            if ($oldStatus !== $newStatus) {
                $stats['updated']++;
            }
            
            switch ($newStatus) {
                case 'In Stock':
                    $stats['in_stock']++;
                    break;
                case 'Low Stock':
                    $stats['low_stock']++;
                    break;
                case 'Out of Stock':
                    $stats['out_of_stock']++;
                    break;
            }
            
            $bar->advance();
        }
        
        $bar->finish();
        $this->newLine(2);
        
        $this->info('Status recalculation complete!');
        $this->table(
            ['Status', 'Count'],
            [
                ['In Stock', $stats['in_stock']],
                ['Low Stock', $stats['low_stock']],
                ['Out of Stock', $stats['out_of_stock']],
                ['Status Changed', $stats['updated']],
            ]
        );
        
        return Command::SUCCESS;
    }
}



