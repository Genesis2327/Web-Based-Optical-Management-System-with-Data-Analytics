import axios from '../lib/http';

export const getAdminProducts = async (filters: {
  branch_id?: string;
  approval_status?: string;
  search?: string;
} = {}) => {
  const params = new URLSearchParams();
  if (filters.branch_id) params.append('branch_id', filters.branch_id);
  if (filters.approval_status) params.append('approval_status', filters.approval_status);
  if (filters.search) params.append('search', filters.search);

  const response = await axios.get(`/admin/products?${params}`);
  return response.data;
};

export const approveProduct = async (productId: number) => {
  const response = await axios.put(`/admin/products/${productId}/approve`);
  return response.data;
};

export const rejectProduct = async (productId: number) => {
  const response = await axios.put(`/admin/products/${productId}/reject`);
  return response.data;
};

export const getManufacturers = async () => {
  const response = await axios.get('/manufacturers');
  return response.data;
};

export const getBranches = async () => {
  const response = await axios.get('/branches/active');
  return response.data;
};
