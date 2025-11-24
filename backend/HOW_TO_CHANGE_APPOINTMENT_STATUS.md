# How to Change Appointment Status

## Quick Guide

To change an appointment status (e.g., from "scheduled" to "in_progress"), use the update endpoint.

---

## API Endpoint

```
PUT /api/appointments/{appointment_id}
```

**Authentication Required**: Yes (Bearer Token)

---

## Request Body

### Change Status Only:
```json
{
  "status": "in_progress"
}
```

### Change Status with Other Fields:
```json
{
  "status": "in_progress",
  "notes": "Patient arrived on time"
}
```

---

## Valid Status Values

| Status | Description | When to Use |
|--------|-------------|-------------|
| `scheduled` | Initial booking status | When appointment is first created |
| `confirmed` | Patient confirmed | When patient confirms they'll attend |
| `in_progress` | Appointment is ongoing | **Use this to allow prescription creation** |
| `completed` | Appointment finished | After consultation is done |
| `cancelled` | Appointment cancelled | Patient/staff cancelled |
| `no_show` | Patient didn't show | Patient didn't arrive |

---

## Step-by-Step Examples

### Example 1: Change Status to "in_progress" (Start Appointment)

#### cURL:
```bash
curl -X PUT http://localhost:8000/api/appointments/1 \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "status": "in_progress"
  }'
```

#### JavaScript/Fetch:
```javascript
const startAppointment = async (appointmentId) => {
  const token = localStorage.getItem('auth_token'); // or however you store your token
  
  const response = await fetch(`http://localhost:8000/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'in_progress'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update appointment status');
  }
  
  return await response.json();
};

// Usage
await startAppointment(1); // Change appointment ID 1 to "in_progress"
```

---

### Example 2: Confirm Appointment (scheduled → confirmed)

```javascript
const confirmAppointment = async (appointmentId) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`http://localhost:8000/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'confirmed'
    })
  });
  
  return await response.json();
};
```

---

### Example 3: Complete Appointment (in_progress → completed)

```javascript
const completeAppointment = async (appointmentId) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`http://localhost:8000/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'completed'
    })
  });
  
  return await response.json();
};
```

---

### Example 4: Cancel Appointment

```javascript
const cancelAppointment = async (appointmentId, reason) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`http://localhost:8000/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'cancelled',
      notes: reason || 'Appointment cancelled'
    })
  });
  
  return await response.json();
};
```

---

## Success Response (200 OK)

```json
{
  "id": 1,
  "patient_id": 5,
  "optometrist_id": 2,
  "branch_id": 1,
  "appointment_date": "2025-11-25",
  "start_time": "12:00",
  "end_time": "13:00",
  "type": "eye_exam",
  "status": "in_progress",
  "notes": null,
  "patient": {
    "id": 5,
    "name": "Test Customer",
    "email": "test@example.com"
  },
  "optometrist": {
    "id": 2,
    "name": "Dr. Samuel Loreto Prieto",
    "email": "dr@example.com"
  },
  "branch": {
    "id": 1,
    "name": "Unitop Branch"
  }
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "User not authenticated"
}
```

### 403 Forbidden
```json
{
  "error": "Unauthorized"
}
```
**Note**: You must have permission to update the appointment (optometrist, staff, or admin)

### 422 Validation Error
```json
{
  "errors": {
    "status": ["The selected status is invalid."]
  }
}
```

---

## Common Workflows

### Workflow 1: Create Prescription (scheduled → in_progress → prescription)
```javascript
// Step 1: Start appointment
await fetch(`/api/appointments/1`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'in_progress' })
});

// Step 2: Create prescription (status must be in_progress)
await fetch('/api/prescriptions', {
  method: 'POST',
  body: JSON.stringify({
    appointment_id: 1,
    right_eye: { sphere: -2.50, cylinder: null, axis: null, pd: 64 },
    left_eye: { sphere: -2.25, cylinder: null, axis: null, pd: 64 }
  })
});
// Note: Appointment automatically changes to "completed" when prescription is created
```

### Workflow 2: Standard Appointment Flow
```
scheduled → confirmed → in_progress → completed
```

---

## Status Transition Rules

### Allowed Transitions:
- ✅ `scheduled` → `confirmed`
- ✅ `scheduled` → `in_progress` (can skip confirmation)
- ✅ `scheduled` → `cancelled`
- ✅ `confirmed` → `in_progress`
- ✅ `confirmed` → `cancelled`
- ✅ `in_progress` → `completed`
- ✅ `in_progress` → `cancelled` (rare)
- ✅ Any status → `no_show` (if patient doesn't arrive)

### Not Recommended:
- ❌ `completed` → `in_progress` (already finished)
- ❌ `cancelled` → `in_progress` (appointment was cancelled)

---

## Additional Fields You Can Update

When updating status, you can also update other fields:

```json
{
  "status": "in_progress",
  "notes": "Patient arrived early",
  "start_time": "11:45",
  "end_time": "12:45",
  "optometrist_id": 2
}
```

**Note**: Only fields you want to change need to be included in the request.

---

## Frontend Integration

If you're using React/TypeScript, you can create a reusable function:

```typescript
import { Appointment } from '@/types/appointment';

interface UpdateAppointmentData {
  status?: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  start_time?: string;
  end_time?: string;
  optometrist_id?: number;
}

const updateAppointment = async (
  appointmentId: number,
  data: UpdateAppointmentData
): Promise<Appointment> => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/appointments/${appointmentId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update appointment');
  }
  
  return await response.json();
};

// Usage examples:
await updateAppointment(1, { status: 'in_progress' });
await updateAppointment(1, { status: 'confirmed' });
await updateAppointment(1, { status: 'completed', notes: 'Consultation completed successfully' });
```

---

## Quick Reference

### To Start Appointment (for prescription creation):
```bash
PUT /api/appointments/{id}
Body: { "status": "in_progress" }
```

### To Confirm Appointment:
```bash
PUT /api/appointments/{id}
Body: { "status": "confirmed" }
```

### To Complete Appointment:
```bash
PUT /api/appointments/{id}
Body: { "status": "completed" }
```

---

## Notes

- ✅ Status changes trigger automatic notifications to the patient
- ✅ Only optometrists, staff, and admins can change status
- ✅ The appointment must exist (valid appointment_id)
- ✅ Invalid status values will return a validation error
- ✅ Patient notification is automatically sent when status changes

