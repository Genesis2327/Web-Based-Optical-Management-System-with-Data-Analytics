import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({ baseURL: API_BASE_URL });

// Attach auth token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getReservations = async () => {
  const response = await api.get('/reservations');
  return response.data;
};

export const createReservation = async (data: { product_id: number; branch_id: number; quantity: number; notes?: string | null }) => {
  const response = await api.post('/reservations', data);
  return response.data;
};

export const updateReservation = async (id: string, data: any) => {
  const response = await api.put(`/reservations/${id}`, data);
  return response.data;
};

export const deleteReservation = async (id: string) => {
  const response = await api.delete(`/reservations/${id}`);
  return response.data;
};
