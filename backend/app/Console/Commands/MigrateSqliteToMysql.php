<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\File;
use PDO;
use Exception;

class MigrateSqliteToMysql extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'migrate:sqlite-to-mysql 
                            {--force : Force migration without confirmation}
                            {--backup : Backup MySQL database before migration}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate all data and structure from SQLite to MySQL database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔄 Starting SQLite to MySQL Migration');
        $this->newLine();

        // Check SQLite file exists
        $sqlitePath = database_path('database.sqlite');
        
        if (!File::exists($sqlitePath)) {
            $this->error("❌ SQLite database not found at: {$sqlitePath}");
            $this->line("");
            $this->line("The SQLite database file doesn't exist. This could mean:");
            $this->line("  1. The file hasn't been created yet");
            $this->line("  2. The file is in a different location");
            $this->line("  3. Data is already in MySQL");
            $this->line("");
            $this->line("If you want to migrate from SQLite, ensure the file exists first.");
            $this->line("If data is already in MySQL, you can skip this migration.");
            return 1;
        }

        $fileSize = File::size($sqlitePath);
        $fileSizeMB = round($fileSize / 1048576, 2);
        $this->info("✓ Found SQLite database: {$sqlitePath} ({$fileSizeMB} MB)");

        // Check MySQL connection
        try {
            $mysqlConnection = DB::connection('mysql');
            $mysqlDatabase = $mysqlConnection->getDatabaseName();
            $this->info("✓ MySQL connection established: {$mysqlDatabase}");
        } catch (Exception $e) {
            $this->error("❌ Cannot connect to MySQL: " . $e->getMessage());
            $this->line("Please ensure MySQL is running and configured in .env");
            return 1;
        }

        // Confirm migration
        if (!$this->option('force')) {
            $this->warn('⚠️  WARNING: This will REPLACE all data in MySQL database!');
            $this->warn('   All existing data in MySQL will be deleted.');
            
            if (!$this->confirm('Do you want to continue?', false)) {
                $this->info('Migration cancelled.');
                return 0;
            }
        }

        // Backup MySQL if requested
        if ($this->option('backup')) {
            $this->info('📦 Creating MySQL backup...');
            $this->call('db:backup', ['--now' => true]);
            $this->newLine();
        }

        // Connect to SQLite
        try {
            $sqlite = new PDO("sqlite:{$sqlitePath}");
            $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->info('✓ Connected to SQLite database');
        } catch (Exception $e) {
            $this->error("❌ Cannot connect to SQLite: " . $e->getMessage());
            return 1;
        }

        // Get all tables from SQLite
        $tables = $sqlite->query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )->fetchAll(PDO::FETCH_COLUMN);

        if (empty($tables)) {
            $this->warn('⚠️  No tables found in SQLite database');
            return 0;
        }

        $this->info("Found " . count($tables) . " tables to migrate");
        $this->newLine();

        // Start MySQL transaction
        DB::connection('mysql')->beginTransaction();

        try {
            // Step 1: Drop all existing tables in MySQL
            $this->info('🗑️  Step 1: Dropping existing MySQL tables...');
            $this->dropAllMysqlTables();
            $this->info('✓ All MySQL tables dropped');
            $this->newLine();

            // Step 2: Get table structures and create in MySQL
            $this->info('🏗️  Step 2: Creating table structures in MySQL...');
            $tableStructures = [];
            
            foreach ($tables as $table) {
                $this->line("  Creating table: {$table}");
                $structure = $this->getTableStructure($sqlite, $table);
                $tableStructures[$table] = $structure;
                $this->createTableInMysql($table, $structure);
            }
            
            $this->info('✓ All table structures created');
            $this->newLine();

            // Step 3: Migrate data
            $this->info('📊 Step 3: Migrating data...');
            $totalRows = 0;
            
            foreach ($tables as $table) {
                $this->line("  Migrating data from: {$table}");
                $rows = $this->migrateTableData($sqlite, $table, $tableStructures[$table]);
                $totalRows += $rows;
                $this->line("    ✓ Migrated {$rows} rows");
            }
            
            $this->info("✓ Data migration completed ({$totalRows} total rows)");
            $this->newLine();

            // Commit transaction
            DB::connection('mysql')->commit();
            
            $this->info('✅ Migration completed successfully!');
            $this->newLine();
            $this->line("📊 Summary:");
            $this->line("   - Tables migrated: " . count($tables));
            $this->line("   - Total rows migrated: {$totalRows}");
            $this->line("   - MySQL database: {$mysqlDatabase}");
            $this->newLine();
            $this->warn('⚠️  Remember to update .env file to use MySQL:');
            $this->line('   DB_CONNECTION=mysql');
            
            return 0;

        } catch (Exception $e) {
            DB::connection('mysql')->rollBack();
            $this->error("❌ Migration failed: " . $e->getMessage());
            $this->error("Stack trace: " . $e->getTraceAsString());
            return 1;
        }
    }

    /**
     * Drop all tables in MySQL database
     */
    private function dropAllMysqlTables()
    {
        $connection = DB::connection('mysql');
        $schema = $connection->getSchemaBuilder();
        
        // Disable foreign key checks
        $connection->statement('SET FOREIGN_KEY_CHECKS=0');
        
        try {
            // Get all tables
            $tables = $schema->getTableListing();
            
            if (!empty($tables)) {
                foreach ($tables as $table) {
                    $connection->statement("DROP TABLE IF EXISTS `{$table}`");
                }
            }
        } finally {
            // Re-enable foreign key checks
            $connection->statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    /**
     * Get table structure from SQLite
     */
    private function getTableStructure(PDO $sqlite, string $table): array
    {
        $columns = $sqlite->query("PRAGMA table_info({$table})")->fetchAll(PDO::FETCH_ASSOC);
        
        $structure = [
            'columns' => [],
            'primary_key' => null,
        ];

        foreach ($columns as $column) {
            $colDef = [
                'name' => $column['name'],
                'type' => $this->convertSqliteTypeToMysql($column['type']),
                'notnull' => $column['notnull'] == 1,
                'default' => $column['dflt_value'],
                'pk' => $column['pk'] == 1,
            ];

            if ($colDef['pk']) {
                $structure['primary_key'] = $colDef['name'];
            }

            $structure['columns'][] = $colDef;
        }

        return $structure;
    }

    /**
     * Convert SQLite data types to MySQL data types
     */
    private function convertSqliteTypeToMysql(string $sqliteType): string
    {
        $type = strtoupper(trim($sqliteType));
        
        // SQLite is flexible, so we need to handle various formats
        if (stripos($type, 'INT') !== false) {
            return 'INTEGER';
        } elseif (stripos($type, 'TEXT') !== false || stripos($type, 'VARCHAR') !== false || stripos($type, 'CHAR') !== false) {
            return 'TEXT';
        } elseif (stripos($type, 'REAL') !== false || stripos($type, 'FLOAT') !== false || stripos($type, 'DOUBLE') !== false || stripos($type, 'DECIMAL') !== false || stripos($type, 'NUMERIC') !== false) {
            return 'DECIMAL(10,2)';
        } elseif (stripos($type, 'BLOB') !== false) {
            return 'BLOB';
        } elseif (stripos($type, 'BOOLEAN') !== false || stripos($type, 'BOOL') !== false) {
            return 'TINYINT(1)';
        } elseif (stripos($type, 'DATE') !== false || stripos($type, 'TIME') !== false || stripos($type, 'DATETIME') !== false || stripos($type, 'TIMESTAMP') !== false) {
            return 'DATETIME';
        }
        
        return 'TEXT'; // Default fallback
    }

    /**
     * Create table in MySQL based on SQLite structure
     */
    private function createTableInMysql(string $table, array $structure)
    {
        $connection = DB::connection('mysql');
        $columns = [];
        $primaryKey = null;

        foreach ($structure['columns'] as $col) {
            $colDef = "`{$col['name']}` {$col['type']}";
            
            if ($col['notnull'] && !$col['pk']) {
                $colDef .= ' NOT NULL';
            }
            
            if ($col['default'] !== null) {
                $default = is_numeric($col['default']) ? $col['default'] : "'{$col['default']}'";
                $colDef .= " DEFAULT {$default}";
            }
            
            if ($col['pk']) {
                $colDef .= ' AUTO_INCREMENT';
                $primaryKey = $col['name'];
            }
            
            $columns[] = $colDef;
        }

        $sql = "CREATE TABLE `{$table}` (" . implode(', ', $columns);
        
        if ($primaryKey) {
            $sql .= ", PRIMARY KEY (`{$primaryKey}`)";
        }
        
        $sql .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        $connection->statement($sql);
    }

    /**
     * Migrate data from SQLite table to MySQL
     */
    private function migrateTableData(PDO $sqlite, string $table, array $structure): int
    {
        // Get all data from SQLite
        $data = $sqlite->query("SELECT * FROM `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($data)) {
            return 0;
        }

        // Insert data in chunks
        $chunks = array_chunk($data, 100);
        $totalRows = 0;

        foreach ($chunks as $chunk) {
            // Prepare data for MySQL (handle nulls, convert types)
            $preparedChunk = array_map(function($row) use ($structure) {
                $prepared = [];
                foreach ($row as $key => $value) {
                    // Handle NULL values
                    if ($value === null) {
                        $prepared[$key] = null;
                    } else {
                        // Convert data types if needed
                        $prepared[$key] = $value;
                    }
                }
                return $prepared;
            }, $chunk);

            try {
                DB::connection('mysql')->table($table)->insert($preparedChunk);
                $totalRows += count($chunk);
            } catch (Exception $e) {
                // If insert fails, try row by row
                foreach ($preparedChunk as $row) {
                    try {
                        DB::connection('mysql')->table($table)->insert($row);
                        $totalRows++;
                    } catch (Exception $rowError) {
                        $this->warn("    ⚠️  Failed to insert row: " . $rowError->getMessage());
                    }
                }
            }
        }

        return $totalRows;
    }
}

