# How to Check and Ensure "Eye Care Products" Category is Visible

## Overview
The "Eye Care Products" category exists in the system, but it might not be visible if:
1. The category hasn't been seeded yet
2. The category is inactive in the database
3. There are no products assigned to this category yet (though this shouldn't hide it)

---

## Step 1: Check if Categories are Seeded

Run the seeder to ensure all categories including "Eye Care Products" are in the database:

```bash
cd backend
php artisan db:seed --class=ProductCategorySeeder
```

Or run the artisan command:

```bash
php artisan categories:seed
```

---

## Step 2: Verify Category Exists via API

### API Endpoint:
```
GET /api/product-categories
```

### Response Should Include:
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Frames",
      "slug": "frames",
      "product_count": 0
    },
    {
      "id": 2,
      "name": "Contact Lenses",
      "slug": "contact-lenses",
      "product_count": 0
    },
    {
      "id": 3,
      "name": "Eye Care Products",
      "slug": "eye-care-products",
      "description": "Eye care solutions, cleaning products, and accessories",
      "product_count": 0
    },
    {
      "id": 4,
      "name": "Sunglasses",
      "slug": "sunglasses",
      "product_count": 0
    }
  ]
}
```

---

## Step 3: Add Products to "Eye Care Products" Category

To make the category more visible and useful, add products to it:

### API Endpoint:
```
POST /api/products
```

### Request Body:
```json
{
  "name": "Contact Lens Solution",
  "description": "Multi-purpose contact lens cleaning solution",
  "price": 299.99,
  "category_id": 3,
  "stock_quantity": 50,
  "brand": "Bausch & Lomb",
  "is_active": true
}
```

Or using the admin panel:
1. Go to Admin → Product Management
2. Click "Add Product"
3. Select "Eye Care Products" from the Category dropdown
4. Fill in product details
5. Save

---

## Step 4: Check Category Status

### Using Laravel Tinker:
```php
// Check if category exists
$category = \App\Models\ProductCategory::where('slug', 'eye-care-products')->first();

if ($category) {
    echo "Category found: " . $category->name . "\n";
    echo "Active: " . ($category->is_active ? "Yes" : "No") . "\n";
    echo "Products: " . $category->products()->count() . "\n";
} else {
    echo "Category not found! Run seeder.\n";
}
```

---

## Step 5: Activate Category if Inactive

If the category exists but is inactive:

### API Endpoint (Admin only):
```
PUT /api/admin/product-categories/{category_id}
```

### Request Body:
```json
{
  "is_active": true
}
```

Or using Laravel Tinker:
```php
$category = \App\Models\ProductCategory::where('slug', 'eye-care-products')->first();
if ($category) {
    $category->update(['is_active' => true]);
    echo "Category activated!\n";
}
```

---

## All Product Categories in System

1. **Frames** (slug: `frames`)
   - Eyeglass frames and prescription frames
   - Sort order: 1

2. **Contact Lenses** (slug: `contact-lenses`)
   - Various types of contact lenses
   - Sort order: 2

3. **Eye Care Products** (slug: `eye-care-products`)
   - Eye care solutions, cleaning products, and accessories
   - Sort order: 3

4. **Sunglasses** (slug: `sunglasses`)
   - UV protection sunglasses and protective eyewear
   - Sort order: 4

---

## Troubleshooting

### Issue: Category not showing in frontend
**Solution**: 
1. Check if category is active: `is_active = true`
2. Check if category exists in database
3. Clear browser cache and refresh
4. Check browser console for API errors

### Issue: Category shows but has 0 products
**Solution**: 
- This is normal! The category will still show even with 0 products
- Add products to the category to populate it

### Issue: Category exists in database but not in API
**Solution**:
1. Check if `is_active` is `true`
2. Check if category was soft-deleted
3. Restore if soft-deleted: `$category->restore()`

---

## Quick Commands

### Seed Categories:
```bash
php artisan db:seed --class=ProductCategorySeeder
```

### Check Categories via Tinker:
```bash
php artisan tinker
> \App\Models\ProductCategory::all()->pluck('name', 'slug')
```

### Activate Category:
```bash
php artisan tinker
> $cat = \App\Models\ProductCategory::where('slug', 'eye-care-products')->first();
> $cat->update(['is_active' => true]);
```

---

## Frontend Display

The "Eye Care Products" category will appear in:
- Product Gallery (Category tabs/filters)
- Product Management (Category dropdown)
- Product Filters (Category selector)

**Note**: Categories are always visible regardless of product count. Only `is_active` status affects visibility.

