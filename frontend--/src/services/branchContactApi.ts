import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface BranchContact {
  id: number;
  branch_id: number;
  branch_name: string;
  phone_number?: string;
  formatted_phone?: string;
  email?: string;
  whatsapp_number?: string;
  formatted_whatsapp?: string;
  whatsapp_link?: string;
  address?: string;
  operating_hours?: string;
  social_media: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  is_active: boolean;
}

export interface BranchContactFormData {
  branch_id: number;
  phone_number?: string;
  email?: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  whatsapp_number?: string;
  address?: string;
  operating_hours?: string;
  is_active?: boolean;
}

/**
 * Get all branch contacts
 */
export const getAllBranchContacts = async (): Promise<{
  contacts: BranchContact[];
  count: number;
}> => {
  const response = await axios.get(`${API_BASE_URL}/branch-contacts`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Get contact information for a specific branch
 */
export const getBranchContact = async (branchId: number): Promise<{
  contact: BranchContact;
}> => {
  const response = await axios.get(`${API_BASE_URL}/branch-contacts/${branchId}`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Get contact information for the user's branch
 */
export const getMyBranchContact = async (): Promise<{
  contact: BranchContact;
}> => {
  const response = await axios.get(`${API_BASE_URL}/branch-contacts/my-branch`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Create or update branch contact information
 */
export const saveBranchContact = async (
  contactData: BranchContactFormData
): Promise<{
  message: string;
  contact: BranchContact;
}> => {
  const response = await axios.post(`${API_BASE_URL}/branch-contacts`, contactData, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Update branch contact information
 */
export const updateBranchContact = async (
  contactId: number,
  contactData: Partial<BranchContactFormData>
): Promise<{
  message: string;
  contact: BranchContact;
}> => {
  const response = await axios.put(`${API_BASE_URL}/branch-contacts/${contactId}`, contactData, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Delete branch contact information
 */
export const deleteBranchContact = async (contactId: number): Promise<{
  message: string;
}> => {
  const response = await axios.delete(`${API_BASE_URL}/branch-contacts/${contactId}`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};
