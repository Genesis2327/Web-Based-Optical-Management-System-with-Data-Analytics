<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Create permissions
        $permissions = [
            // Product permissions
            ['name' => 'View Products', 'slug' => 'products.view', 'module' => 'products'],
            ['name' => 'Create Products', 'slug' => 'products.create', 'module' => 'products'],
            ['name' => 'Update Products', 'slug' => 'products.update', 'module' => 'products'],
            ['name' => 'Delete Products', 'slug' => 'products.delete', 'module' => 'products'],
            
            // User permissions
            ['name' => 'View Users', 'slug' => 'users.view', 'module' => 'users'],
            ['name' => 'Create Users', 'slug' => 'users.create', 'module' => 'users'],
            ['name' => 'Update Users', 'slug' => 'users.update', 'module' => 'users'],
            ['name' => 'Delete Users', 'slug' => 'users.delete', 'module' => 'users'],
            
            // Inventory permissions
            ['name' => 'View Inventory', 'slug' => 'inventory.view', 'module' => 'inventory'],
            ['name' => 'Manage Inventory', 'slug' => 'inventory.manage', 'module' => 'inventory'],
            
            // Receipt permissions
            ['name' => 'View Receipts', 'slug' => 'receipts.view', 'module' => 'receipts'],
            ['name' => 'Create Receipts', 'slug' => 'receipts.create', 'module' => 'receipts'],
            ['name' => 'Update Receipts', 'slug' => 'receipts.update', 'module' => 'receipts'],
            
            // Admin permissions
            ['name' => 'Admin Access', 'slug' => 'admin.access', 'module' => 'admin'],
            ['name' => 'Manage Roles', 'slug' => 'roles.manage', 'module' => 'admin'],
            ['name' => 'Manage Permissions', 'slug' => 'permissions.manage', 'module' => 'admin'],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                ['slug' => $permission['slug']],
                $permission
            );
        }

        // Create roles
        $adminRole = Role::firstOrCreate(
            ['slug' => 'admin'],
            [
                'name' => 'Administrator',
                'description' => 'Full system access',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        $staffRole = Role::firstOrCreate(
            ['slug' => 'staff'],
            [
                'name' => 'Staff',
                'description' => 'Staff member with limited access',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        $optometristRole = Role::firstOrCreate(
            ['slug' => 'optometrist'],
            [
                'name' => 'Optometrist',
                'description' => 'Optometrist with patient care access',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        $customerRole = Role::firstOrCreate(
            ['slug' => 'customer'],
            [
                'name' => 'Customer',
                'description' => 'Customer with limited access',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        // Assign all permissions to admin
        $adminRole->permissions()->sync(Permission::pluck('id'));

        // Assign limited permissions to staff
        $staffPermissions = Permission::whereIn('slug', [
            'products.view',
            'inventory.view',
            'receipts.view',
            'receipts.create',
        ])->pluck('id');
        $staffRole->permissions()->sync($staffPermissions);

        // Assign optometrist permissions
        $optometristPermissions = Permission::whereIn('slug', [
            'products.view',
            'users.view',
            'receipts.view',
            'receipts.create',
        ])->pluck('id');
        $optometristRole->permissions()->sync($optometristPermissions);
    }
}

