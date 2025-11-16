import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Get auth token from session storage
const getAuthToken = () => {
  return sessionStorage.getItem('auth_token');
};

// Get headers with auth token
const getHeaders = () => {
  const token = getAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
};

// Optometrist Rotation API
export const optometristRotationApi = {
  // Get all optometrist rotations
  getAllRotations: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/optometrist-rotations`, {
        headers: getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching optometrist rotations:', error);
      throw error;
    }
  },

  // Create or update optometrist rotation
  createRotation: async (rotationData: {
    optometrist_id: number;
    rotation_schedule: Array<{
      day: number;
      branch_id: number;
      start_time: string;
      end_time: string;
    }>;
    is_active?: boolean;
  }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/optometrist-rotations`, rotationData, {
        headers: getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error creating optometrist rotation:', error);
      throw error;
    }
  },

  // Get optometrist availability for appointments
  getAvailability: async (params?: {
    branch_id?: number;
    day_of_week?: number;
  }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/optometrist-rotations/availability`, {
        headers: getHeaders(),
        params,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching optometrist availability:', error);
      throw error;
    }
  },

  // Get optometrists for a specific branch
  getOptometristsForBranch: async (branchId: number, dayOfWeek?: number) => {
    try {
      const params = dayOfWeek ? { day_of_week: dayOfWeek } : {};
      const response = await axios.get(`${API_BASE_URL}/optometrist-rotations/branch/${branchId}`, {
        headers: getHeaders(),
        params,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching optometrists for branch:', error);
      throw error;
    }
  },

  // Delete optometrist rotation
  deleteRotation: async (rotationId: number) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/optometrist-rotations/${rotationId}`, {
        headers: getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting optometrist rotation:', error);
      throw error;
    }
  },
};

export default optometristRotationApi;

// Standalone functions for easier imports
export const getOptometristRotations = optometristRotationApi.getAllRotations;
export const createOptometristRotation = optometristRotationApi.createRotation;
export const getOptometristAvailability = optometristRotationApi.getAvailability;
export const getOptometristsForBranch = optometristRotationApi.getOptometristsForBranch;
export const deleteOptometristRotation = optometristRotationApi.deleteRotation;
