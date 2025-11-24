# Branch Inventory Management Guide

## Overview
The EverBright Optical Clinic System uses **branch-based inventory management**. Each branch maintains its own inventory of products, and staff members can only manage inventory for their assigned branch.

---

## 🔑 Key Concepts

### 1. **Branch Inventory Structure**
- Each **branch** has its own inventory
- Each **product** can exist in multiple branches with different stock levels
- Stock is tracked per branch using the `branch_stock` table
- Staff members can only access inventory for their assigned branch

### 2. **User Branch Assignment**
- **Staff members** MUST have a `branch_id` assigned to view/manage inventory
- **Admin** users can view inventory from all branches
- **Optometrists** can be assigned to multiple branches

---

## ❌ Common Issue: "No branch assigned to your account"

If you see this message, it means:
- The staff member doesn't have a `branch_id` assigned
- They cannot view or manage any inventory until assigned to a branch

### Solution: Assign Branch to Staff Member

Only **Admin** users can assign branches to staff members.

---

## 📋 How to Assign Branch to Staff

### API Endpoint:
```
PUT /api/admin/users/{user_id}
```

### Request Body:
```json
{
  "branch_id": 1,
  "name": "Staff Name",
  "email": "staff@example.com",
  "role": "staff",
  "is_approved": true
}
```

### Example Request:
```javascript
// Assign branch to staff member (Admin only)
const assignBranchToStaff = async (userId, branchId) => {
  const token = localStorage.getItem('auth_token'); // Admin token
  
  const response = await fetch(`http://localhost:8000/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      branch_id: branchId,
      is_approved: true
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to assign branch');
  }
  
  return await response.json();
};

// Usage - Assign "Emerald Branch" (ID: 2) to staff member (ID: 5)
await assignBranchToStaff(5, 2);
```

### cURL Example:
```bash
curl -X PUT http://localhost:8000/api/admin/users/5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "branch_id": 2,
    "is_approved": true
  }'
```

---

## 📊 Branch Inventory API Endpoints

### 1. Get Branch Inventory

#### For Staff (Their Branch Only):
```
GET /api/branch-inventory
```

#### For Admin (All Branches or Filter by Branch):
```
GET /api/branch-inventory?branch_id=1
```

### Response:
```json
{
  "inventories": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Ray-Ban Aviator",
      "product_sku": "RB-001",
      "branch_id": 1,
      "branch_name": "Emerald Branch",
      "stock_quantity": 50,
      "available_quantity": 45,
      "reserved_quantity": 5,
      "min_stock_threshold": 10,
      "price": 199.99,
      "status": "in_stock"
    }
  ],
  "summary": {
    "total_products": 25,
    "total_stock": 150,
    "low_stock_items": 3,
    "out_of_stock_items": 1
  },
  "user_branch_id": 1,
  "user_role": "staff"
}
```

---

### 2. Add Product to Branch Inventory

#### For Staff (Auto-assigned to their branch):
```
POST /api/branch-inventory
```

#### For Admin (Specify branch):
```
POST /api/branch-inventory
Body: { "branch_id": 1, ... }
```

### Request Body:
```json
{
  "name": "New Product",
  "description": "Product description",
  "price": 199.99,
  "stock_quantity": 50,
  "min_stock_threshold": 10,
  "category_id": 1,
  "images": [/* file uploads */]
}
```

### Example:
```javascript
const addProductToInventory = async (productData) => {
  const token = localStorage.getItem('auth_token');
  
  const formData = new FormData();
  formData.append('name', productData.name);
  formData.append('description', productData.description);
  formData.append('price', productData.price);
  formData.append('stock_quantity', productData.stockQuantity);
  formData.append('min_stock_threshold', productData.minThreshold);
  
  // Add images if provided
  if (productData.images) {
    productData.images.forEach((image) => {
      formData.append('images[]', image);
    });
  }
  
  const response = await fetch('http://localhost:8000/api/branch-inventory', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return await response.json();
};
```

---

### 3. Update Branch Inventory Stock

```
PUT /api/branch-inventory/{branch_stock_id}
```

### Request Body:
```json
{
  "stock_quantity": 75,
  "min_stock_threshold": 15,
  "price_override": 179.99
}
```

---

### 4. Delete Product from Branch Inventory

```
DELETE /api/branch-inventory/{branch_stock_id}
```

---

## 🔍 How Branch Inventory Works

### 1. **Product Creation**
When a product is added to inventory:
- A **Product** record is created in `products` table
- A **BranchStock** record is created in `branch_stock` table linking the product to the branch
- Staff members can only add products to their assigned branch
- Admins can add products to any branch

### 2. **Stock Tracking**
Each branch maintains:
- **Stock Quantity**: Total units available
- **Reserved Quantity**: Units reserved for pending orders
- **Available Quantity**: Stock - Reserved (calculated automatically)
- **Min Stock Threshold**: Alert level for low stock
- **Price Override**: Branch-specific pricing (optional)

### 3. **Access Control**

#### Staff Members:
- ✅ Can view/manage inventory for their assigned branch only
- ❌ Cannot access other branches' inventory
- ❌ Cannot assign themselves to a branch (admin only)

#### Admin Users:
- ✅ Can view/manage inventory for all branches
- ✅ Can filter by branch using `?branch_id=X`
- ✅ Can assign branches to staff members

#### Optometrists:
- ✅ Can be assigned to multiple branches
- ✅ Can view schedules for all assigned branches

---

## 📝 Database Structure

### `branch_stock` Table
Stores inventory for each product at each branch:

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `product_id` | integer | Foreign key to products |
| `branch_id` | integer | Foreign key to branches |
| `stock_quantity` | integer | Total stock units |
| `reserved_quantity` | integer | Reserved for orders |
| `min_stock_threshold` | integer | Low stock alert level |
| `price_override` | decimal | Branch-specific price |
| `status` | string | in_stock, low_stock, out_of_stock |

### Relationship:
```
Product (1) ──→ (Many) BranchStock ──→ (1) Branch
```

---

## 🛠️ Complete Examples

### Example 1: Assign Branch to Staff (Admin)
```javascript
// Admin assigns "Emerald Branch" to a staff member
const assignBranch = async (staffUserId, branchId) => {
  const adminToken = localStorage.getItem('admin_token');
  
  const response = await fetch(`http://localhost:8000/api/admin/users/${staffUserId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      branch_id: branchId,
      is_approved: true
    })
  });
  
  const result = await response.json();
  console.log('Branch assigned:', result);
  
  return result;
};

// Usage
await assignBranch(5, 2); // Assign branch ID 2 to user ID 5
```

---

### Example 2: Get Branch Inventory (Staff)
```javascript
// Staff member gets inventory for their assigned branch
const getBranchInventory = async () => {
  const token = localStorage.getItem('staff_token');
  
  const response = await fetch('http://localhost:8000/api/branch-inventory', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.message === 'Staff member is not assigned to any branch') {
    console.error('No branch assigned!');
    return null;
  }
  
  return data;
};

// Usage
const inventory = await getBranchInventory();
console.log('Inventory:', inventory.inventories);
console.log('Summary:', inventory.summary);
```

---

### Example 3: Get Branch Inventory (Admin - All Branches)
```javascript
// Admin gets inventory for all branches or specific branch
const getBranchInventory = async (branchId = null) => {
  const token = localStorage.getItem('admin_token');
  
  let url = 'http://localhost:8000/api/branch-inventory';
  if (branchId) {
    url += `?branch_id=${branchId}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};

// Usage - Get all branches
const allInventory = await getBranchInventory();

// Usage - Get specific branch
const emeraldInventory = await getBranchInventory(2);
```

---

### Example 4: Add Product to Branch Inventory
```javascript
const addProductToBranch = async (productData) => {
  const token = localStorage.getItem('staff_token'); // or admin_token
  
  const formData = new FormData();
  formData.append('name', productData.name);
  formData.append('description', productData.description);
  formData.append('price', productData.price);
  formData.append('stock_quantity', productData.stockQuantity);
  formData.append('min_stock_threshold', productData.minThreshold || 5);
  
  if (productData.categoryId) {
    formData.append('category_id', productData.categoryId);
  }
  
  // Add images
  if (productData.images && productData.images.length > 0) {
    productData.images.forEach((image) => {
      formData.append('images[]', image);
    });
  }
  
  // Admin can specify branch_id, staff uses their assigned branch
  if (productData.branchId) {
    formData.append('branch_id', productData.branchId);
  }
  
  const response = await fetch('http://localhost:8000/api/branch-inventory', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add product');
  }
  
  return await response.json();
};

// Usage
await addProductToBranch({
  name: 'Ray-Ban Aviator',
  description: 'Classic aviator sunglasses',
  price: 199.99,
  stockQuantity: 50,
  minThreshold: 10,
  categoryId: 1,
  images: [/* File objects */]
});
```

---

## ⚠️ Important Notes

1. **Branch Assignment Required**: 
   - Staff members MUST have a `branch_id` assigned to access inventory
   - Only admins can assign branches to staff

2. **Staff Limitations**:
   - Staff can only manage their assigned branch's inventory
   - Cannot access other branches' inventory

3. **Admin Privileges**:
   - Admins can view/manage all branches
   - Can filter by branch using query parameter
   - Can assign branches to staff members

4. **Product Duplication**:
   - The same product can exist in multiple branches
   - Each branch maintains separate stock levels
   - Branch-specific pricing can be set using `price_override`

5. **Low Stock Alerts**:
   - Automatic alerts when stock falls below `min_stock_threshold`
   - Alerts are branch-specific

---

## 🔧 Troubleshooting

### Issue: "No branch assigned to your account"
**Problem**: Staff member doesn't have a `branch_id`  
**Solution**: Admin needs to assign a branch using `PUT /api/admin/users/{id}` with `{"branch_id": X}`

### Issue: Empty inventory list
**Problem**: No products added to branch inventory yet  
**Solution**: Add products using `POST /api/branch-inventory`

### Issue: Cannot access other branch inventory
**Problem**: Staff can only access their assigned branch  
**Solution**: This is expected behavior. Admins can access all branches.

### Issue: Cannot assign branch
**Problem**: Only admins can assign branches  
**Solution**: Use admin account to assign branches to staff

---

## 📚 Related Endpoints

### User Management (Admin):
```
PUT /api/admin/users/{id}  # Assign branch to staff
GET /api/admin/users       # List all users
```

### Branch Inventory:
```
GET /api/branch-inventory              # Get inventory (staff: their branch, admin: all)
POST /api/branch-inventory             # Add product to branch
PUT /api/branch-inventory/{id}         # Update stock
DELETE /api/branch-inventory/{id}      # Remove product
GET /api/branch-inventory/low-stock    # Get low stock alerts
GET /api/branch-inventory/summary      # Get inventory summary
```

### Branch Management:
```
GET /api/branches           # List all branches
GET /api/branches/{id}      # Get branch details
```

---

## 💡 Quick Reference

### Assign Branch to Staff (Admin):
```
PUT /api/admin/users/{user_id}
Body: { "branch_id": 2, "is_approved": true }
```

### Get Branch Inventory (Staff):
```
GET /api/branch-inventory
```

### Get Branch Inventory (Admin - Specific Branch):
```
GET /api/branch-inventory?branch_id=2
```

### Add Product to Branch:
```
POST /api/branch-inventory
Body: FormData with product details
```

