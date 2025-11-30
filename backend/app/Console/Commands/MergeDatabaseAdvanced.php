<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Exception;

class MergeDatabaseAdvanced extends Command
{
    protected $signature = 'db:merge-advanced {sql_file : Path to the SQL file to merge} 
                                               {--backup : Create a backup before merging}
                                               {--dry-run : Show what would be merged without actually doing it}';

    protected $description = 'Advanced merge: Intelligently combine SQL file data with existing database';

    protected $dryRun = false;
    protected $stats = [];

    public function handle()
    {
        $sqlFile = $this->argument('sql_file');
        
        if (!File::exists($sqlFile) && !file_exists($sqlFile)) {
            $this->error("❌ SQL file not found: {$sqlFile}");
            return 1;
        }

        $this->dryRun = $this->option('dry-run');

        if ($this->option('backup') && !$this->dryRun) {
            $this->info('📦 Creating database backup...');
            try {
                $this->call('db:backup', ['--now' => true]);
            } catch (Exception $e) {
                $this->warn('⚠️  Backup failed (continuing anyway): ' . $e->getMessage());
            }
            $this->newLine();
        }

        if ($this->dryRun) {
            $this->warn('🔍 DRY RUN MODE - No changes will be made');
            $this->newLine();
        }

        $this->info('🔄 Starting advanced database merge...');
        $this->newLine();

        try {
            $sqlContent = File::get($sqlFile);
            
            // Extract all INSERT statements with their data
            $insertData = $this->extractAllInserts($sqlContent);
            
            $this->info("Found data for " . count($insertData) . " tables");
            $this->newLine();
            
            // Process each table
            foreach ($insertData as $tableName => $rows) {
                $this->processTableData($tableName, $rows);
            }
            
            $this->displaySummary();
            
            return 0;
            
        } catch (Exception $e) {
            $this->error("❌ Error: " . $e->getMessage());
            if ($this->option('verbose')) {
                $this->error($e->getTraceAsString());
            }
            return 1;
        }
    }

    protected function extractAllInserts($sqlContent)
    {
        $tables = [];
        
        // Pattern to match INSERT statements
        $pattern = '/INSERT\s+INTO\s+`([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*((?:\([^)]+\),?\s*)+);/is';
        
        preg_match_all($pattern, $sqlContent, $matches, PREG_SET_ORDER);
        
        foreach ($matches as $match) {
            $tableName = $match[1];
            $columnNames = array_map('trim', explode(',', str_replace(['`', ' '], '', $match[2])));
            
            // Extract all value rows
            $valuesString = trim($match[3]);
            preg_match_all('/\([^)]+\)/', $valuesString, $rowMatches);
            
            if (!isset($tables[$tableName])) {
                $tables[$tableName] = [
                    'columns' => $columnNames,
                    'rows' => []
                ];
            }
            
            foreach ($rowMatches[0] as $rowString) {
                $values = $this->parseRowValues($rowString);
                if (count($values) === count($columnNames)) {
                    $combined = array_combine($columnNames, $values);
                    if ($combined !== false) {
                        $tables[$tableName]['rows'][] = $combined;
                    }
                }
            }
        }
        
        return $tables;
    }

    protected function parseRowValues($rowString)
    {
        $rowString = trim($rowString, '()');
        $values = [];
        $current = '';
        $inQuotes = false;
        $quoteChar = null;
        
        for ($i = 0; $i < strlen($rowString); $i++) {
            $char = $rowString[$i];
            
            if (!$inQuotes && ($char === '"' || $char === "'")) {
                $inQuotes = true;
                $quoteChar = $char;
                $current .= $char;
            } elseif ($inQuotes && $char === $quoteChar) {
                // Check for escaped quote
                if ($i > 0 && $rowString[$i - 1] === '\\') {
                    $current .= $char;
                } else {
                    $inQuotes = false;
                    $quoteChar = null;
                    $current .= $char;
                }
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

    protected function processTableData($tableName, $tableData)
    {
        if (!Schema::hasTable($tableName)) {
            $this->warn("⚠️  Table '{$tableName}' does not exist, skipping...");
            return;
        }
        
        $columns = $tableData['columns'];
        $rows = $tableData['rows'];
        
        $rowCount = count($rows);
        $this->line("Processing <comment>{$tableName}</comment> ({$rowCount} rows)...");
        
        // Get existing primary keys/unique identifiers
        $primaryKey = $this->getPrimaryKey($tableName);
        $existingIds = [];
        
        if ($primaryKey) {
            $existingIds = DB::table($tableName)
                ->pluck($primaryKey)
                ->toArray();
        }
        
        // Also check for unique emails in users table
        $existingEmails = [];
        if ($tableName === 'users' && in_array('email', $columns)) {
            $existingEmails = DB::table($tableName)
                ->pluck('email')
                ->toArray();
        }
        
        $added = 0;
        $skipped = 0;
        
        $progressBar = $this->output->createProgressBar(count($rows));
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%% -- %message%');
        $progressBar->setMessage('Processing...');
        $progressBar->start();
        
        DB::beginTransaction();
        
        try {
            foreach ($rows as $row) {
                // Clean row data - only include columns that exist in the current table
                $cleanRow = [];
                $tableColumns = Schema::getColumnListing($tableName);
                
                foreach ($row as $key => $value) {
                    // Only include columns that exist in the current table schema
                    if (in_array($key, $tableColumns)) {
                        // Remove quotes and handle NULL
                        $value = trim($value, "\"'");
                        if (strtoupper($value) === 'NULL') {
                            $cleanRow[$key] = null;
                        } else {
                            $cleanRow[$key] = $value;
                        }
                    }
                    // Skip columns that don't exist in current schema
                }
                
                // Skip if no valid columns found
                if (empty($cleanRow)) {
                    $skipped++;
                    $progressBar->setMessage("Skipped (no matching columns)");
                    $progressBar->advance();
                    continue;
                }
                
                // Check for duplicates
                $isDuplicate = false;
                
                // Check primary key
                if ($primaryKey && isset($cleanRow[$primaryKey])) {
                    if (in_array($cleanRow[$primaryKey], $existingIds)) {
                        $isDuplicate = true;
                    }
                }
                
                // Check email uniqueness for users
                if (!$isDuplicate && $tableName === 'users' && isset($cleanRow['email'])) {
                    if (in_array($cleanRow['email'], $existingEmails)) {
                        $isDuplicate = true;
                    }
                }
                
                if ($isDuplicate) {
                    $skipped++;
                    $progressBar->setMessage("Skipped duplicate");
                    $progressBar->advance();
                    continue;
                }
                
                // Insert record
                if (!$this->dryRun) {
                    try {
                        DB::table($tableName)->insert($cleanRow);
                        
                        // Update tracking arrays
                        if ($primaryKey && isset($cleanRow[$primaryKey])) {
                            $existingIds[] = $cleanRow[$primaryKey];
                        }
                        if ($tableName === 'users' && isset($cleanRow['email'])) {
                            $existingEmails[] = $cleanRow['email'];
                        }
                        
                        $added++;
                        $progressBar->setMessage("Added");
                    } catch (Exception $e) {
                        // Check if it's a duplicate key error
                        if (strpos($e->getMessage(), 'Duplicate entry') !== false ||
                            strpos($e->getMessage(), 'Integrity constraint violation') !== false) {
                            $skipped++;
                            $progressBar->setMessage("Skipped (duplicate)");
                        } else {
                            throw $e;
                        }
                    }
                } else {
                    $added++;
                    $progressBar->setMessage("Would add");
                }
                
                $progressBar->advance();
            }
            
            if (!$this->dryRun) {
                DB::commit();
            } else {
                DB::rollBack();
            }
            
            $progressBar->finish();
            $this->newLine();
            
            $this->info("  ✓ Added: {$added}, Skipped: {$skipped}");
            $this->newLine();
            
            // Update stats
            if (!isset($this->stats[$tableName])) {
                $this->stats[$tableName] = ['added' => 0, 'skipped' => 0];
            }
            $this->stats[$tableName]['added'] += $added;
            $this->stats[$tableName]['skipped'] += $skipped;
            
        } catch (Exception $e) {
            DB::rollBack();
            $progressBar->finish();
            $this->newLine();
            $this->error("  ❌ Error: " . $e->getMessage());
            throw $e;
        }
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
        
        $totalAdded = 0;
        $totalSkipped = 0;
        
        foreach ($this->stats as $table => $counts) {
            $totalAdded += $counts['added'];
            $totalSkipped += $counts['skipped'];
            
            if ($counts['added'] > 0 || $counts['skipped'] > 0) {
                $this->line("  {$table}:");
                $this->line("    ✓ Added: {$counts['added']}");
                $this->line("    ⊘ Skipped: {$counts['skipped']}");
            }
        }
        
        $this->newLine();
        $this->info("Total Records Added: {$totalAdded}");
        $this->info("Total Records Skipped (duplicates): {$totalSkipped}");
        
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

