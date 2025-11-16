<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;

class BackupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:backup {--now : Force immediate backup}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backup the MySQL/MariaDB database with automatic rotation';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        if (!env('DB_BACKUP_ENABLED', true)) {
            $this->warn('⚠️ Database backups are disabled in .env');
            $this->line('Set DB_BACKUP_ENABLED=true to enable backups');
            return 1;
        }

        $this->info('🔄 Starting database backup...');

        // Get database configuration
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        
        // Only support MySQL/MariaDB
        if (!in_array($driver, ['mysql', 'mariadb'])) {
            $this->error("❌ Database backup only supports MySQL/MariaDB. Current driver: {$driver}");
            return 1;
        }

        $config = $connection->getConfig();
        $database = $config['database'] ?? 'everbright_optical';
        $host = $config['host'] ?? '127.0.0.1';
        $port = $config['port'] ?? '3306';
        $username = $config['username'] ?? 'root';
        $password = $config['password'] ?? '';

        // Create backup directory
        $backupDir = storage_path('backups/database');
        
        if (!File::exists($backupDir)) {
            File::makeDirectory($backupDir, 0755, true);
            $this->line('📁 Created backup directory');
        }

        // Generate backup filename with timestamp
        $timestamp = now()->format('Y-m-d_H-i-s');
        $backupName = "everbright_optical_backup_{$timestamp}.sql";
        $backupPath = "{$backupDir}/{$backupName}";

        // Build mysqldump command
        $mysqldumpPath = $this->findMysqldumpPath();
        
        if (!$mysqldumpPath) {
            $this->error('❌ mysqldump command not found. Please ensure MySQL/MariaDB client tools are installed.');
            return 1;
        }

        // Build command with password handling
        $command = sprintf(
            '"%s" --host=%s --port=%s --user=%s --single-transaction --routines --triggers %s > %s',
            $mysqldumpPath,
            escapeshellarg($host),
            escapeshellarg($port),
            escapeshellarg($username),
            escapeshellarg($database),
            escapeshellarg($backupPath)
        );

        // Set password via environment variable (more secure than command line)
        $env = $_ENV;
        if (!empty($password)) {
            $env['MYSQL_PWD'] = $password;
        }

        // Execute backup
        try {
            $this->line("📊 Backing up database: {$database}");
            
            $process = proc_open($command, [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes, null, $env);

            if (!is_resource($process)) {
                throw new \Exception('Failed to start mysqldump process');
            }

            fclose($pipes[0]);
            $stdout = stream_get_contents($pipes[1]);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            $returnCode = proc_close($process);

            if ($returnCode !== 0 || !File::exists($backupPath)) {
                $errorMsg = $stderr ?: 'Unknown error occurred';
                throw new \Exception("mysqldump failed: {$errorMsg}");
            }

            $size = File::size($backupPath);
            $sizeInMB = round($size / 1048576, 2);
            
            $this->info("✅ Database backed up successfully!");
            $this->newLine();
            $this->line("   📄 File: {$backupName}");
            $this->line("   📊 Size: {$sizeInMB} MB");
            $this->line("   📂 Location: {$backupPath}");
            $this->line("   🗄️  Database: {$database}");
            $this->newLine();
            
            // Clean old backups
            $this->cleanOldBackups($backupDir);
            
            return 0;
        } catch (\Exception $e) {
            $this->error("❌ Backup failed: " . $e->getMessage());
            if (File::exists($backupPath)) {
                File::delete($backupPath);
            }
            return 1;
        }
    }
    
    /**
     * Find mysqldump executable path
     */
    private function findMysqldumpPath()
    {
        // Common paths for mysqldump
        $paths = [
            'mysqldump', // In PATH
            'C:\\xampp\\mysql\\bin\\mysqldump.exe',
            'C:\\wamp64\\bin\\mysql\\mysql8.0.xx\\bin\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            'C:\\Program Files\\MariaDB\\10.11\\bin\\mysqldump.exe',
            'C:\\Program Files\\MariaDB\\10.10\\bin\\mysqldump.exe',
            'C:\\Program Files\\MariaDB\\10.9\\bin\\mysqldump.exe',
            '/usr/bin/mysqldump',
            '/usr/local/bin/mysqldump',
            '/opt/homebrew/bin/mysqldump',
        ];

        foreach ($paths as $path) {
            if ($this->commandExists($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Check if command exists and is executable
     */
    private function commandExists($command)
    {
        $whereIsCommand = (PHP_OS == 'WINNT') ? 'where' : 'which';
        
        $process = proc_open("{$whereIsCommand} {$command}", [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ], $pipes);

        if (!is_resource($process)) {
            return false;
        }

        $stdout = stream_get_contents($pipes[1]);
        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);

        return !empty($stdout);
    }
    
    /**
     * Clean old backups based on retention policy
     */
    private function cleanOldBackups($dir)
    {
        $retentionDays = env('DB_BACKUP_RETENTION_DAYS', 30);
        $files = File::glob("{$dir}/everbright_optical_backup_*.sql");
        
        if (empty($files)) {
            return;
        }
        
        $now = time();
        $deleted = 0;
        $totalSize = 0;
        
        foreach ($files as $file) {
            $age = ($now - File::lastModified($file)) / 86400; // Convert to days
            
            if ($age > $retentionDays) {
                $size = File::size($file);
                $totalSize += $size;
                File::delete($file);
                $deleted++;
            }
        }
        
        if ($deleted > 0) {
            $totalSizeInMB = round($totalSize / 1048576, 2);
            $this->line("🗑️  Cleaned {$deleted} old backup(s) (>{$retentionDays} days old)");
            $this->line("   Freed {$totalSizeInMB} MB of disk space");
        }
        
        // Show remaining backups
        $remainingFiles = File::glob("{$dir}/everbright_optical_backup_*.sql");
        $this->newLine();
        $this->line("📦 Total backups: " . count($remainingFiles));
    }
}
