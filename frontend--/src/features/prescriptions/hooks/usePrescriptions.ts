import { useState, useEffect } from 'react';
import { Prescription, CreatePrescriptionRequest, UpdatePrescriptionRequest } from '../services/prescription.service';
import {
  getPrescriptions,
  getPrescription,
  createPrescription,
  updatePrescription,
  deletePrescription,
  getPatientPrescriptions
} from '../services/prescription.service';

export const usePrescriptions = (params?: any) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPrescriptions(params);
      setPrescriptions(response.data.data || response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [JSON.stringify(params)]);

  const refetch = () => fetchPrescriptions();

  return { prescriptions, loading, error, refetch };
};

export const usePrescription = (id: string) => {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescription = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getPrescription(id);
      setPrescription(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch prescription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescription();
  }, [id]);

  const refetch = () => fetchPrescription();

  return { prescription, loading, error, refetch };
};

export const useCreatePrescription = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: CreatePrescriptionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await createPrescription(data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create prescription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
};

export const useUpdatePrescription = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (id: string, data: UpdatePrescriptionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await updatePrescription(id, data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update prescription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
};

export const useDeletePrescription = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deletePrescription(id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete prescription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { remove, loading, error };
};

export const usePatientPrescriptions = (patientId: number | null) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatientPrescriptions = async () => {
    if (!patientId) {
      setPrescriptions([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getPatientPrescriptions(patientId);
      // Handle both { data: [...] } and [...] response formats
      const prescriptionsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      
      // Sort prescriptions by appointment date (newest first) - issue date should match appointment date
      const sortedPrescriptions = prescriptionsData.sort((a: Prescription, b: Prescription) => {
        const dateA = new Date(a.appointment?.appointment_date || a.issue_date);
        const dateB = new Date(b.appointment?.appointment_date || b.issue_date);
        return dateB.getTime() - dateA.getTime();
      });
      
      setPrescriptions(sortedPrescriptions);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch patient prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientPrescriptions();
  }, [patientId]);

  const refetch = () => fetchPatientPrescriptions();

  return { prescriptions, loading, error, refetch };
};
