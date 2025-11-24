# How to Create a Prescription in EverBright Optical Clinic System

## 📋 Overview
Prescriptions can only be created by **optometrists** and must be associated with an appointment that is in **"in_progress"** status.

---

## 🔄 Complete Workflow

### Step 1: Start the Appointment
Change appointment status from `scheduled` → `in_progress`

### Step 2: Create the Prescription
Create prescription for the `in_progress` appointment

---

## 🚀 Quick Start Guide

### API Endpoints Needed:

1. **Update Appointment Status**: `PUT /api/appointments/{id}`
2. **Create Prescription**: `POST /api/prescriptions`

---

## 📝 Step 1: Change Appointment Status to "in_progress"

### Endpoint:
```
PUT /api/appointments/{appointment_id}
```

### Request Body:
```json
{
  "status": "in_progress"
}
```

### Example:
```javascript
// Start the appointment
const startAppointment = async (appointmentId) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`http://localhost:8000/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
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

## 📝 Step 2: Create Prescription

### Endpoint:
```
POST /api/prescriptions
```

### Authentication Required:
✅ Yes (Bearer Token)  
✅ Role: Optometrist

### Required Data Structure:

#### Minimum Required Fields:
```json
{
  "appointment_id": 1,
  "right_eye": {
    "sphere": null,
    "cylinder": null,
    "axis": null,
    "pd": null
  },
  "left_eye": {
    "sphere": null,
    "cylinder": null,
    "axis": null,
    "pd": null
  }
}
```

#### Complete Request Body (All Fields):
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
  "additional_notes": "Patient has astigmatism in both eyes",
  "recommendations": "Recommend blue light filter coating",
  "lens_type": "single_vision",
  "coating": "anti-reflective",
  "follow_up_date": "2025-12-15",
  "follow_up_notes": "Schedule follow-up in 6 months"
}
```

---

## 📊 Field Descriptions

### Required Fields

#### `appointment_id` (Required)
- **Type**: Integer
- **Description**: ID of the appointment for which prescription is being created
- **Validation**: Must exist in `appointments` table and must be in `in_progress` status

#### `right_eye` (Required - Object)
- **sphere**: Numeric value (nullable) - Power in diopters (e.g., -2.50, +1.75, 0.00)
- **cylinder**: Numeric value (nullable) - Cylindrical power (e.g., -0.75, +0.50)
- **axis**: Numeric value 0-180 (nullable) - Axis in degrees (e.g., 90, 120, 180)
- **pd**: Numeric value ≥ 0 (nullable) - Pupillary Distance in mm (e.g., 64, 62)

#### `left_eye` (Required - Object)
- Same structure as `right_eye`

### Optional Fields

#### `vision_acuity` (Optional)
- **Type**: String (max 50 chars)
- **Examples**: "20/20", "20/25", "20/30"

#### `additional_notes` (Optional)
- **Type**: String (max 1000 chars)
- **Description**: Additional clinical notes about the prescription

#### `recommendations` (Optional)
- **Type**: String (max 1000 chars)
- **Description**: Recommendations for the patient

#### `lens_type` (Optional)
- **Type**: String (max 100 chars)
- **Examples**: "single_vision", "progressive", "bifocal", "trifocal"

#### `coating` (Optional)
- **Type**: String (max 100 chars)
- **Examples**: "anti-reflective", "blue-light", "photochromic", "polarized"

#### `follow_up_date` (Optional)
- **Type**: Date (format: YYYY-MM-DD)
- **Validation**: Must be after today
- **Example**: "2025-12-15"

#### `follow_up_notes` (Optional)
- **Type**: String (max 1000 chars)
- **Description**: Notes for follow-up appointment

---

## 💻 Complete JavaScript Example

### Option 1: Two Separate Calls
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
  
  if (!response.ok) {
    throw new Error('Failed to start appointment');
  }
  
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
      additional_notes: prescriptionData.notes,
      recommendations: prescriptionData.recommendations,
      follow_up_date: prescriptionData.followUpDate,
      follow_up_notes: prescriptionData.followUpNotes
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Failed to create prescription');
  }
  
  return await response.json();
};

// Complete workflow
const createPrescriptionWorkflow = async (appointmentId, prescriptionData) => {
  try {
    // Step 1: Start appointment
    await startAppointment(appointmentId);
    console.log('Appointment started successfully');
    
    // Step 2: Create prescription
    const prescription = await createPrescription(appointmentId, prescriptionData);
    console.log('Prescription created:', prescription);
    
    return prescription;
  } catch (error) {
    console.error('Error in prescription workflow:', error);
    throw error;
  }
};

// Usage
await createPrescriptionWorkflow(1, {
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

### Option 2: Using Axios (if you're using axios)
```javascript
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token interceptor
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Start appointment and create prescription
const createPrescriptionWorkflow = async (appointmentId, prescriptionData) => {
  try {
    // Step 1: Start appointment
    await axiosInstance.put(`/appointments/${appointmentId}`, {
      status: 'in_progress'
    });
    
    // Step 2: Create prescription
    const response = await axiosInstance.post('/prescriptions', {
      appointment_id: appointmentId,
      right_eye: prescriptionData.rightEye,
      left_eye: prescriptionData.leftEye,
      vision_acuity: prescriptionData.visionAcuity,
      lens_type: prescriptionData.lensType,
      coating: prescriptionData.coating,
      additional_notes: prescriptionData.notes
    });
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
};
```

---

## 📨 Success Response (201 Created)

```json
{
  "id": 1,
  "appointment_id": 1,
  "patient_id": 5,
  "optometrist_id": 2,
  "branch_id": 1,
  "type": "glasses",
  "prescription_number": "RX-000001",
  "prescription_data": {
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
    "prescription_number": "RX-000001"
  },
  "issue_date": "2025-12-01",
  "expiry_date": "2026-12-01",
  "status": "active",
  "notes": "Patient has astigmatism in both eyes",
  "patient": {
    "id": 5,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "optometrist": {
    "id": 2,
    "name": "Dr. Samuel Loreto Prieto",
    "email": "dr@example.com"
  },
  "appointment": {
    "id": 1,
    "appointment_date": "2025-12-01",
    "status": "completed"
  }
}
```

---

## ❌ Error Responses

### 401 Unauthorized
```json
{
  "error": "User not authenticated"
}
```
**Solution**: Make sure you're logged in and have a valid auth token

### 403 Forbidden
```json
{
  "error": "Only optometrists can create prescriptions"
}
```
**Solution**: You must be logged in as an optometrist role

### 422 Validation Error
```json
{
  "errors": {
    "appointment_id": ["The appointment id field is required."],
    "right_eye": ["The right eye field is required."],
    "left_eye.axis": ["The left eye.axis must be between 0 and 180."]
  }
}
```
**Solution**: Check that all required fields are provided and values are valid

### 422 Business Logic Error
```json
{
  "error": "Can only create prescriptions for appointments in progress"
}
```
**Solution**: First change the appointment status to "in_progress" using `PUT /api/appointments/{id}` with `{"status": "in_progress"}`

---

## ✅ What Happens Automatically When Prescription is Created?

1. ✅ **Prescription record** is created in the database
2. ✅ **Appointment status** automatically changes to **"completed"**
3. ✅ **Prescription number** is auto-generated (format: RX-000001, RX-000002, etc.)
4. ✅ **Issue date** is set to today's date
5. ✅ **Expiry date** is set to 1 year from today
6. ✅ **Status** is set to "active"
7. ✅ **Optometrist** is auto-assigned to the appointment (if not already assigned)
8. ✅ **Notification** is sent to the patient
9. ✅ **Realtime event** is emitted to update the frontend

---

## 🔄 Common Use Cases

### Use Case 1: Simple Distance Prescription
```json
{
  "appointment_id": 1,
  "right_eye": {
    "sphere": -2.50,
    "cylinder": null,
    "axis": null,
    "pd": 64
  },
  "left_eye": {
    "sphere": -2.25,
    "cylinder": null,
    "axis": null,
    "pd": 64
  }
}
```

### Use Case 2: Astigmatism Correction
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
  "lens_type": "single_vision"
}
```

### Use Case 3: Progressive Lenses with Full Details
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
  "lens_type": "progressive",
  "coating": "anti-reflective,blue-light",
  "recommendations": "Patient should wear glasses for computer work",
  "additional_notes": "Patient has presbyopia",
  "follow_up_date": "2026-06-01",
  "follow_up_notes": "Check prescription after 6 months"
}
```

---

## 🛠️ cURL Examples

### Complete Workflow (Start + Create):

```bash
# Step 1: Start appointment
curl -X PUT http://localhost:8000/api/appointments/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"status": "in_progress"}'

# Step 2: Create prescription
curl -X POST http://localhost:8000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
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
    "coating": "anti-reflective"
  }'
```

---

## 📚 Related API Endpoints

### Get All Prescriptions
```
GET /api/prescriptions
```

### Get Specific Prescription
```
GET /api/prescriptions/{prescription_id}
```

### Get Patient's Prescriptions
```
GET /api/prescriptions/patient/{patient_id}
```

### Update Prescription
```
PUT /api/prescriptions/{prescription_id}
```

### Delete Prescription
```
DELETE /api/prescriptions/{prescription_id}
```

### Update Appointment Status
```
PUT /api/appointments/{appointment_id}
Body: { "status": "in_progress" }
```

---

## ⚠️ Important Notes

1. **Appointment Status Requirement**: 
   - Appointment must be in **"in_progress"** status before creating prescription
   - Use `PUT /api/appointments/{id}` with `{"status": "in_progress"}` first

2. **Role Requirement**: 
   - Only users with **optometrist** role can create prescriptions

3. **Automatic Status Change**: 
   - When prescription is created, appointment automatically changes to **"completed"**
   - You don't need to manually change appointment to completed

4. **Prescription Number**: 
   - Auto-generated sequentially (RX-000001, RX-000002, etc.)
   - Format: `RX-{6-digit-zero-padded-ID}`

5. **Expiry Date**: 
   - Automatically set to 1 year from issue date

6. **Eye Measurements**: 
   - All fields within `right_eye` and `left_eye` are optional (can be null)
   - But the arrays themselves are required

7. **Optometrist Assignment**: 
   - If appointment doesn't have an optometrist assigned, the system automatically assigns the logged-in optometrist

---

## 🔍 Troubleshooting

### Error: "Can only create prescriptions for appointments in progress"
**Problem**: Appointment status is not "in_progress"  
**Solution**: 
```javascript
// First, start the appointment
await fetch(`/api/appointments/${appointmentId}`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'in_progress' })
});

// Then create prescription
await fetch('/api/prescriptions', {
  method: 'POST',
  body: JSON.stringify({ appointment_id: appointmentId, ... })
});
```

### Error: "Only optometrists can create prescriptions"
**Problem**: User is not logged in as optometrist  
**Solution**: Make sure you're logged in with an optometrist account

### Error: "The appointment id field is required"
**Problem**: Missing appointment_id in request  
**Solution**: Include `appointment_id` in the request body

### Error: "The right eye field is required"
**Problem**: Missing right_eye object  
**Solution**: Include `right_eye` object (can have null values, but object must exist)

---

## 📖 Quick Reference

### Complete Workflow Summary:
```
1. PUT /api/appointments/{id} → { "status": "in_progress" }
2. POST /api/prescriptions → { "appointment_id": X, "right_eye": {...}, "left_eye": {...} }
```

### Valid Lens Types:
- `single_vision`
- `progressive`
- `bifocal`
- `trifocal`

### Valid Coating Types:
- `anti-reflective`
- `blue-light`
- `photochromic`
- `polarized`
- Multiple coatings: `"anti-reflective,blue-light"`

---

## 💡 Pro Tips

1. **Always check appointment status first** before attempting to create prescription
2. **Validate eye measurements** on frontend before sending (axis 0-180, PD positive)
3. **Store appointment_id** when starting appointment to use for prescription creation
4. **Handle errors gracefully** - show user-friendly messages based on error type
5. **Use the complete workflow** - always start appointment before creating prescription
