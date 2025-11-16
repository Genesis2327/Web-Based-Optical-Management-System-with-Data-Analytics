export interface Appointment {
  id: number;
  patient_id: number;
  optometrist_id: number;
  branch_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  patient?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  optometrist?: {
    id: number;
    name: string;
    email: string;
  };
  branch?: {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export const AppointmentType = {
  EYE_EXAM: 'eye_exam',
  CONTACT_FITTING: 'contact_fitting',
  FOLLOW_UP: 'follow_up',
  CONSULTATION: 'consultation',
  EMERGENCY: 'emergency'
} as const;

export type AppointmentType = typeof AppointmentType[keyof typeof AppointmentType];

export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
} as const;

export type AppointmentStatus = typeof AppointmentStatus[keyof typeof AppointmentStatus];

export interface CreateAppointmentRequest {
  patient_id: number;
  optometrist_id: number;
  branch_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: AppointmentType;
  notes?: string;
}

export interface UpdateAppointmentRequest extends Partial<CreateAppointmentRequest> {
  status?: AppointmentStatus;
}

export interface AppointmentFilters {
  date?: string;
  optometrist_id?: number;
  status?: AppointmentStatus;
  type?: AppointmentType;
  patient_name?: string;
}

export interface AppointmentSlot {
  date: string;
  time: string;
  available: boolean;
  optometrist_id: number;
}

export interface Optometrist {
  id: number;
  name: string;
  email: string;
  role: string;
}

// Constants for dropdowns
export const APPOINTMENT_TYPES = [
  'eye_exam',
  'contact_fitting',
  'follow_up',
  'consultation',
  'emergency'
] as const;

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
] as const;
