import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import websocketService, { NotificationData, AppointmentNotification, InventoryNotification } from '@/services/websocketService';

interface PrescriptionNotification {
  id: number;
  type: string;
  message: string;
  prescription: {
    id: number;
    patient_id: number;
    appointment_id: number;
  };
  patient?: {
    id: number;
    name: string;
  };
  optometrist?: {
    id: number;
    name: string;
  };
  timestamp: string;
}

interface UseWebSocketOptions {
  onAppointmentCreated?: (data: AppointmentNotification) => void;
  onAppointmentUpdated?: (data: AppointmentNotification) => void;
  onAppointmentCancelled?: (data: AppointmentNotification) => void;
  onAppointmentCompleted?: (data: AppointmentNotification) => void;
  onInventoryLowStock?: (data: InventoryNotification) => void;
  onInventoryRestocked?: (data: InventoryNotification) => void;
  onInventoryOutOfStock?: (data: InventoryNotification) => void;
  onGeneralNotification?: (data: NotificationData) => void;
  onAlertNotification?: (data: NotificationData) => void;
  onUrgentNotification?: (data: NotificationData) => void;
  onPrescriptionCreated?: (data: PrescriptionNotification) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<NotificationData | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!user) return;

    // Update connection status
    const updateConnectionStatus = () => {
      setIsConnected(websocketService.isConnected());
    };

    // Initial status check
    updateConnectionStatus();

    // Set up event listeners
    const handleAppointmentCreated = (data: AppointmentNotification) => {
      setLastNotification({
        id: data.id.toString(),
        type: 'appointment-created',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onAppointmentCreated?.(data);
    };

    const handleAppointmentUpdated = (data: AppointmentNotification) => {
      setLastNotification({
        id: data.id.toString(),
        type: 'appointment-updated',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onAppointmentUpdated?.(data);
    };

    const handleAppointmentCancelled = (data: AppointmentNotification) => {
      setLastNotification({
        id: data.id.toString(),
        type: 'appointment-cancelled',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onAppointmentCancelled?.(data);
    };

    const handleAppointmentCompleted = (data: AppointmentNotification) => {
      setLastNotification({
        id: data.id.toString(),
        type: 'appointment-completed',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onAppointmentCompleted?.(data);
    };

    const handleInventoryLowStock = (data: InventoryNotification) => {
      setLastNotification({
        id: `inventory-${data.product.id}-${Date.now()}`,
        type: 'inventory-low-stock',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onInventoryLowStock?.(data);
    };

    const handleInventoryRestocked = (data: InventoryNotification) => {
      setLastNotification({
        id: `inventory-${data.product.id}-${Date.now()}`,
        type: 'inventory-restocked',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onInventoryRestocked?.(data);
    };

    const handleInventoryOutOfStock = (data: InventoryNotification) => {
      setLastNotification({
        id: `inventory-${data.product.id}-${Date.now()}`,
        type: 'inventory-out-of-stock',
        message: data.message,
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onInventoryOutOfStock?.(data);
    };

    const handleGeneralNotification = (data: NotificationData) => {
      setLastNotification(data);
      optionsRef.current.onGeneralNotification?.(data);
    };

    const handleAlertNotification = (data: NotificationData) => {
      setLastNotification(data);
      optionsRef.current.onAlertNotification?.(data);
    };

    const handleUrgentNotification = (data: NotificationData) => {
      setLastNotification(data);
      optionsRef.current.onUrgentNotification?.(data);
    };

    const handlePrescriptionCreated = (data: PrescriptionNotification) => {
      setLastNotification({
        id: data.id.toString(),
        type: 'prescription-created',
        message: data.message || 'Your prescription has been created',
        timestamp: data.timestamp,
        data
      });
      optionsRef.current.onPrescriptionCreated?.(data);
    };

    // Register event listeners
    websocketService.on('appointment-created', handleAppointmentCreated);
    websocketService.on('appointment-updated', handleAppointmentUpdated);
    websocketService.on('appointment-cancelled', handleAppointmentCancelled);
    websocketService.on('appointment-completed', handleAppointmentCompleted);
    websocketService.on('inventory-low-stock', handleInventoryLowStock);
    websocketService.on('inventory-restocked', handleInventoryRestocked);
    websocketService.on('inventory-out-of-stock', handleInventoryOutOfStock);
    websocketService.on('general-notification', handleGeneralNotification);
    websocketService.on('alert-notification', handleAlertNotification);
    websocketService.on('urgent-notification', handleUrgentNotification);
    websocketService.on('prescription-created', handlePrescriptionCreated);

    // Join user-specific and role-specific channels
    if (user) {
      websocketService.joinChannel(`user.${user.id}`);
      
      // Join role-specific channels
      websocketService.joinChannel(`role.${user.role}`);
      
      // Join branch-specific channel if user has a branch
      if (user.branch_id) {
        websocketService.joinChannel(`branch.${user.branch_id}`);
      }
    }

    // Check connection status periodically
    const statusInterval = setInterval(updateConnectionStatus, 5000);

    return () => {
      // Cleanup event listeners
      websocketService.off('appointment-created', handleAppointmentCreated);
      websocketService.off('appointment-updated', handleAppointmentUpdated);
      websocketService.off('appointment-cancelled', handleAppointmentCancelled);
      websocketService.off('appointment-completed', handleAppointmentCompleted);
      websocketService.off('inventory-low-stock', handleInventoryLowStock);
      websocketService.off('inventory-restocked', handleInventoryRestocked);
      websocketService.off('inventory-out-of-stock', handleInventoryOutOfStock);
      websocketService.off('general-notification', handleGeneralNotification);
      websocketService.off('alert-notification', handleAlertNotification);
      websocketService.off('urgent-notification', handleUrgentNotification);
      websocketService.off('prescription-created', handlePrescriptionCreated);

      // Leave channels
      if (user) {
        websocketService.leaveChannel(`user.${user.id}`);
        websocketService.leaveChannel(`role.${user.role}`);
        if (user.branch_id) {
          websocketService.leaveChannel(`branch.${user.branch_id}`);
        }
      }

      clearInterval(statusInterval);
    };
  }, [user]);

  return {
    isConnected,
    lastNotification,
    reconnect: () => websocketService.reconnect(),
    disconnect: () => websocketService.disconnect(),
  };
};

export default useWebSocket;
