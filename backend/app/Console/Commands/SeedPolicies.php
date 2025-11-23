<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Database\Seeders\PolicySeeder;

class SeedPolicies extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'policies:seed';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Seed the database with initial Privacy Policy and Terms and Conditions';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Seeding Privacy Policy and Terms and Conditions...');
        $this->newLine();

        $seeder = new PolicySeeder();
        $seeder->setCommand($this);
        $seeder->run();

        return Command::SUCCESS;
    }
}

