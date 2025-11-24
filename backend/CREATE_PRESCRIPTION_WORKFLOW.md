# Complete Workflow: How to Create a Prescription

## Current Situation
Your appointments are showing as **"scheduled"** status. To create a prescription, you need to:

1. ✅ **Change appointment status to "in_progress"**
2. ✅ **Then create the prescription**

---

## Step-by-Step Process

### **Step 1: Start the Appointment (Set to "in_progress")**

#### API Endpoint:
```
PUT /api/appointments/{appointment_id}
```

#### Request Body:
```json
{
  "status": "in_progress"
}
```

#### Example cURL:
```bash
curl -X PUT http://localhost:8000/api/appointments/1 \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "status": "in_progress"
  }'
```

#### Example JavaScript:
```javascript
const startAppointment = async (appointmentId) => {
  const token = localStorage.getItem('auth_token');
  
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
    throw new Error('Failed to start appointment');
  }
  
  return await response.json();
};

// Usage
await startAppointment(1); // Start appointment with ID 1
```

---

### **Step 2: Create Prescription**

Once the appointment is "in_progress", you can create the prescription.

#### API Endpoint:
```
POST /api/prescriptions
```

#### Request Body:
```json
{
  "appointment_id": 1,
  "right_eye": {
    "sphere": -2.50,
    "cylinder": -0.75,
    "axis": 90,
    "pd": 64
  },
  "left_eye": {
    "sphere": -2.25,
    "cylinder": -0.50,
    "axis": 85,
    "pd": 64
  },
  "vision_acuity": "20/20",
  "lens_type": "single_vision",
  "coating": "anti-reflective",
  "additional_notes": "Patient needs progressive lenses"
}
```

---

## Complete Example (Both Steps)

```javascript
// Step 1: Start the appointment
const startAppointment = async (appointmentId) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`http://localhost:8000/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'in_progress' })
  });
  
  if (!response.ok) throw new Error('Failed to start appointment');
  return await response.json();
};

// Step 2: Create prescription
const createPrescription = async (appointmentId, prescriptionData) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch('http://localhost:8000/api/prescriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      appointment_id: appointmentId,
      right_eye: prescriptionData.rightEye,
      left_eye: prescriptionData.leftEye,
      vision_acuity: prescriptionData.visionAcuity,
      lens_type: prescriptionData.lensType,
      coating: prescriptionData.coating,
      additional_notes: prescriptionData.notes
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create prescription');
  }
  
  return await response.json();
};

// Complete workflow
const completeWorkflow = async (appointmentId, prescriptionData) => {
  try {
    // Step 1: Start appointment
    await startAppointment(appointmentId);
    console.log('Appointment started successfully');
    
    // Step 2: Create prescription
    const prescription = await createPrescription(appointmentId, prescriptionData);
    console.log('Prescription created:', prescription);
    
    return prescription;
  } catch (error) {
    console.error('Error in workflow:', error);
    throw error;
  }
};

// Usage
await completeWorkflow(1, {
  rightEye: {
    sphere: -2.50,
    cylinder: -0.75,
    axis: 90,
    pd: 64
  },
  leftEye: {
    sphere: -2.25,
    cylinder: -0.50,
    axis: 85,
    pd: 64
  },
  visionAcuity: "20/20",
  lensType: "single_vision",
  coating: "anti-reflective",
  notes: "Patient needs progressive lenses"
});
```

---

## What Happens Automatically

### When you change status to "in_progress":
- ✅ Appointment status updates to "in_progress"
- ✅ Patient may receive notification (depending on your notification setup)

### When you create prescription:
- ✅ Prescription is created
- ✅ Prescription number auto-generated (RX-000001, etc.)
- ✅ Appointment status automatically changes to **"completed"**
- ✅ Patient receives notification about prescription
- ✅ Prescription expiry date set to 1 year from today

---

## Frontend Interface Notes

Based on your appointments interface, the Actions column appears empty because:
1. The appointments are in "scheduled" status
2. Action buttons should appear when:
   - Status is "scheduled" or "confirmed" → Show "Start Appointment" / "Take Over" button
   - Status is "in_progress" → Show "Create Prescription" button
   - Status is "completed" → No action button (prescription already created)

The frontend code (OptometristAppointments.tsx) shows that:
- **"Create Prescription"** button appears when `status === 'in_progress'` AND `optometrist_id === user.id`

---

## Quick Reference

### Appointment Status Flow:
```
scheduled → in_progress → completed
                ↓
         (prescription created here)
```

### Valid Appointment Statuses:
- `scheduled` - Initial status
- `confirmed` - Patient confirmed
- `in_progress` - Appointment started (can create prescription)
- `completed` - Prescription created / appointment finished
- `cancelled` - Appointment cancelled
- `no_show` - Patient didn't show

---

## Troubleshooting

### Error: "Can only create prescriptions for appointments in progress"
**Solution**: Change appointment status to "in_progress" first

### Error: "Only optometrists can create prescriptions"
**Solution**: Make sure you're logged in as an optometrist role

### Error: "Doctor not found"
**Solution**: The appointment might not be assigned to an optometrist. The system will auto-assign when creating prescription.

---

## Related Endpoints

### Update Appointment Status:
```
PUT /api/appointments/{id}
Body: { "status": "in_progress" }
```

### Create Prescription:
```
POST /api/prescriptions
Body: { "appointment_id": 1, "right_eye": {...}, "left_eye": {...} }
```

### Get Appointment Details:
```
GET /api/appointments/{id}
```

### Get All Prescriptions:
```
GET /api/prescriptions
```

