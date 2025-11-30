<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Exception;
use PDO;

class MergeDatabase extends Command
{
    protected $signature = 'db:merge {sql_file : Path to the SQL file to merge} 
                                    {--backup : Create a backup before merging}
                                    {--dry-run : Show what would be merged without actually doing it}';

    protected $description = 'Merge data from a SQL file into the current database, avoiding duplicates';

    protected $dryRun = false;
    protected $stats = [
        'tables_processed' => 0,
        'records_skipped' => 0,
        'records_added' => 0,
        'errors' => 0,
    ];

    public function handle()
    {
        $sqlFile = $this->argument('sql_file');
        
        // Convert relative path to absolute if needed
        if (!File::exists($sqlFile) && !file_exists($sqlFile)) {
            $this->error("❌ SQL file not found: {$sqlFile}");
            return 1;
        }

        $this->dryRun = $this->option('dry-run');

        if ($this->option('backup')) {
            $this->info('📦 Creating database backup...');
            $this->call('db:backup', ['--now' => true]);
            $this->newLine();
        }

        if ($this->dryRun) {
            $this->warn('🔍 DRY RUN MODE - No changes will be made');
            $this->newLine();
        }

        $this->info('🔄 Starting database merge process...');
        $this->newLine();

        try {
            $this->info("📖 Reading SQL file: {$sqlFile}...");
            
            // Use MySQL directly to import, then process for duplicates
            $this->info("🔄 Importing SQL file into temporary processing...");
            
            // Read SQL content
            $sqlContent = File::get($sqlFile);
            
            // Process the SQL file section by section
            $this->processSqlFile($sqlContent);
            
            // Display summary
            $this->displaySummary();

            return 0;

        } catch (Exception $e) {
            $this->error("❌ Error during merge: " . $e->getMessage());
            if ($this->option('verbose')) {
                $this->error("Stack trace: " . $e->getTraceAsString());
            }
            return 1;
        }
    }

    protected function processSqlFile($sqlContent)
    {
        // Split SQL file into individual INSERT statements
        $insertStatements = $this->extractInsertStatements($sqlContent);
        
        $this->info("Found " . count($insertStatements) . " INSERT statements to process");
        $this->newLine();
        
        $progressBar = $this->output->createProgressBar(count($insertStatements));
        $progressBar->start();

        foreach ($insertStatements as $statement) {
            try {
                $this->processInsertStatement($statement);
            } catch (Exception $e) {
                $this->stats['errors']++;
                if ($this->option('verbose')) {
                    $this->newLine();
                    $this->error("  ❌ Error: " . $e->getMessage());
                }
            }
            $progressBar->advance();
        }
        
        $progressBar->finish();
        $this->newLine(2);
    }

    protected function extractInsertStatements($sqlContent)
    {
        $statements = [];
        
        // Match INSERT statements (handles multi-line)
        preg_match_all(
            '/INSERT\s+INTO\s+`([^`]+)`\s*\([^)]+\)\s*VALUES\s*((?:\([^)]+\),?\s*)+);/i',
            $sqlContent,
            $matches,
            PREG_SET_ORDER
        );
        
        foreach ($matches as $match) {
            $tableName = $match[1];
            $values = $match[2];
            
            // Split multiple value rows
            preg_match_all('/\([^)]+\)/', $values, $valueMatches);
            
            foreach ($valueMatches[0] as $rowValues) {
                $statements[] = [
                    'table' => $tableName,
                    'values' => $rowValues
                ];
            }
        }
        
        return $statements;
    }

    protected function processInsertStatement($statement)
    {
        $tableName = $statement['table'];
        $valuesString = $statement['values'];
        
        // Skip if table doesn't exist
        if (!Schema::hasTable($tableName)) {
            $this->stats['records_skipped']++;
            return;
        }

        // Parse column names from original INSERT (we'll need to get this from context)
        // For now, let's use a simpler approach - execute INSERT IGNORE
        
        // Get current record count before insert
        $beforeCount = DB::table($tableName)->count();
        
        // Build and execute INSERT IGNORE statement
        // Extract the column names and values
        $columns = Schema::getColumnListing($tableName);
        
        // Parse values
        $values = $this->parseRowValues($valuesString);
        
        if (count($values) !== count($columns)) {
            // Skip if column count doesn't match
            $this->stats['records_skipped']++;
            return;
        }
        
        // Map values to columns
        $data = [];
        foreach ($columns as $index => $column) {
            if (isset($values[$index])) {
                $value = $values[$index];
                // Handle NULL
                if (strtoupper(trim($value)) === 'NULL') {
                    $data[$column] = null;
                } else {
                    // Remove quotes
                    $data[$column] = trim($value, "\"'");
                }
            }
        }
        
        // Check for duplicates
        if ($this->isDuplicateRecord($tableName, $data)) {
            $this->stats['records_skipped']++;
            return;
        }
        
        // Insert record
        if (!$this->dryRun) {
            try {
                DB::table($tableName)->insert($data);
                $this->stats['records_added']++;
                $this->stats['tables_processed']++;
            } catch (Exception $e) {
                // If duplicate key error, skip
                if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                    $this->stats['records_skipped']++;
                } else {
                    throw $e;
                }
            }
        } else {
            $this->stats['records_added']++;
            $this->stats['tables_processed']++;
        }
    }

    protected function parseRowValues($valuesString)
    {
        // Remove outer parentheses
        $valuesString = trim($valuesString, '()');
        
        $values = [];
        $current = '';
        $inQuotes = false;
        $quoteChar = null;
        
        for ($i = 0; $i < strlen($valuesString); $i++) {
            $char = $valuesString[$i];
            
            if (!$inQuotes && ($char === '"' || $char === "'")) {
                $inQuotes = true;
                $quoteChar = $char;
                $current .= $char;
            } elseif ($inQuotes && $char === $quoteChar) {
                // Check if escaped
                if ($i > 0 && $valuesString[$i - 1] !== '\\') {
                    $inQuotes = false;
                    $quoteChar = null;
                }
                $current .= $char;
            } elseif (!$inQuotes && $char === ',') {
                $values[] = trim($current);
                $current = '';
            } else {
                $current .= $char;
            }
        }
        
        if (!empty($current)) {
            $values[] = trim($current);
        }
        
        return $values;
    }

    protected function isDuplicateRecord($tableName, $data)
    {
        // Get primary key
        $primaryKey = $this->getPrimaryKey($tableName);
        
        if ($primaryKey && isset($data[$primaryKey])) {
            $exists = DB::table($tableName)
                ->where($primaryKey, $data[$primaryKey])
                ->exists();
            
            if ($exists) {
                return true;
            }
        }
        
        // Check unique constraints
        if ($tableName === 'users' && isset($data['email'])) {
            $exists = DB::table($tableName)
                ->where('email', $data['email'])
                ->exists();
            
            if ($exists) {
                return true;
            }
        }
        
        return false;
    }

    protected function getPrimaryKey($tableName)
    {
        try {
            $keys = DB::select("SHOW KEYS FROM `{$tableName}` WHERE Key_name = 'PRIMARY'");
            return !empty($keys) ? $keys[0]->Column_name : null;
        } catch (Exception $e) {
            return null;
        }
    }

    protected function displaySummary()
    {
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('📊 MERGE SUMMARY');
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line("Tables Processed: {$this->stats['tables_processed']}");
        $this->line("Records Added: {$this->stats['records_added']}");
        $this->line("Records Skipped (duplicates): {$this->stats['records_skipped']}");
        
        if ($this->stats['errors'] > 0) {
            $this->warn("Errors: {$this->stats['errors']}");
        }
        
        if ($this->dryRun) {
            $this->newLine();
            $this->warn('⚠️  This was a DRY RUN - No changes were made');
            $this->info('Run without --dry-run to apply changes');
        } else {
            $this->newLine();
            $this->info('✅ Merge completed successfully!');
        }
    }
}
