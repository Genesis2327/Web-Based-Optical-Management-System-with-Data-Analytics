<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique(); // e.g., 'STA_ROSA', 'CABUYAO'
            $table->text('address');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        
        // Add foreign key constraints to tables that reference branches
        $tablesWithBranchId = [
            'schedule_change_requests',
            'branch_contacts',
            'enhanced_inventories'
        ];
        
        foreach ($tablesWithBranchId as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'branch_id')) {
                try {
                    Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                        // Check if foreign key doesn't already exist
                        $foreignKeys = DB::select("
                            SELECT CONSTRAINT_NAME 
                            FROM information_schema.KEY_COLUMN_USAGE 
                            WHERE TABLE_SCHEMA = DATABASE() 
                            AND TABLE_NAME = '{$tableName}' 
                            AND COLUMN_NAME = 'branch_id' 
                            AND REFERENCED_TABLE_NAME IS NOT NULL
                        ");
                        
                        if (empty($foreignKeys)) {
                            $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
                        }
                    });
                } catch (\Exception $e) {
                    // Foreign key might already exist, ignore
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
