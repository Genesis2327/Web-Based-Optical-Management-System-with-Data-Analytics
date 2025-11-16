import { io, Socket } from 'socket.io-client';

interface NotificationData {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface AppointmentNotification {
  id: number;
  type: string;
  message: string;
  appointment: {
    id: number;
    date: string;
    time: string;
    status: string;
    patient?: {
      id: number;
      name: string;
      email: string;
    };
    optometrist?: {
      id: number;
      name: string;
    };
    branch?: {
      id: number;
      name: string;
    };
  };
  timestamp: string;
}

interface InventoryNotification {
  type: string;
  message: string;
  product: {
    id: number;
    name: string;
    sku: string;
    image: string;
  };
  branch: {
    id: number;
    name: string;
    address: string;
  };
  stock: {
    current_level: number;
    threshold: number;
    status: 'low' | 'normal';
  };
  timestamp: string;
}

interface EyewearConditionNotification {
  id: string;
  type: string;
  message: string;
  eyewear_label: string;
  condition: 'good' | 'needs_fix' | 'needs_replacement' | 'bad';
  assessment_date: string;
  next_check_date?: string;
  notes?: string;
  assessed_by: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
}

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

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();
  private isConnecting = false;
  private connectionDisabled = false;
  private hasLoggedError = false;

  constructor() {
    // Only connect if WebSocket is enabled (check env var or default behavior)
    const websocketEnabled = import.meta.env.VITE_WEBSOCKET_ENABLED !== 'false';
    if (websocketEnabled) {
      // Delay initial connection to avoid blocking page load
      setTimeout(() => {
        this.connect();
      }, 1000);
    } else {
      this.connectionDisabled = true;
      if (import.meta.env.DEV) {
        console.log('WebSocket is disabled via environment variable');
      }
    }
  }

  private setupGlobalErrorHandler(): void {
    // This will be called to set up error suppression if needed
    // We handle errors in the connect method instead
  }

  private connect(): void {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting || this.connectionDisabled) {
      return;
    }

    // Don't attempt to reconnect if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (!this.hasLoggedError) {
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.warn('WebSocket server is not available. Real-time features will be unavailable. You can start the WebSocket server or disable it via VITE_WEBSOCKET_ENABLED=false');
        }
        this.hasLoggedError = true;
      }
      return;
    }

    const rawToken = localStorage.getItem('token') || sessionStorage.getItem('auth_token');
    
    if (!rawToken) {
      // Silently return - token will be available after login
      return;
    }

    this.isConnecting = true;

    try {
      // Ensure Bearer prefix for servers expecting Authorization-like value in auth.token
      const token = rawToken.toLowerCase().startsWith('bearer ')
        ? rawToken
        : `Bearer ${rawToken}`;
      
      const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:6001';
      
      // Suppress console errors during socket creation
      // Always suppress WebSocket errors, but allow one log in dev mode on first attempt
      const originalError = console.error;
      const originalWarn = console.warn;
      const isFirstAttempt = this.reconnectAttempts === 0 && import.meta.env.DEV;
      
      // Always set up error suppression to catch socket.io errors
      console.error = (...args: any[]) => {
        // Only suppress WebSocket-related errors
        const message = args[0]?.toString() || '';
        const fullMessage = JSON.stringify(args);
        const allArgs = args.map(a => String(a)).join(' ');
        
        // Check if this is a WebSocket-related error
        const isWebSocketError = 
          message.includes('WebSocket') || 
          message.includes('socket.io') || 
          message.includes('ERR_CONNECTION_REFUSED') ||
          message.includes('net::ERR_CONNECTION_REFUSED') ||
          fullMessage.includes('ws://127.0.0.1:6001') ||
          fullMessage.includes('ws://localhost:6001') ||
          fullMessage.includes('socket.io/?EIO=') ||
          allArgs.includes('WebSocket') ||
          allArgs.includes('socket.io') ||
          allArgs.includes('ERR_CONNECTION_REFUSED');
        
        if (!isWebSocketError) {
          originalError.apply(console, args);
        } else if (isFirstAttempt && !this.hasLoggedError) {
          // Allow one log in dev mode on first attempt
          originalError.apply(console, args);
          this.hasLoggedError = true;
        }
        // Otherwise suppress WebSocket errors silently
      };
      
      console.warn = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        const fullMessage = JSON.stringify(args);
        const allArgs = args.map(a => String(a)).join(' ');
        
        const isWebSocketWarning = 
          message.includes('WebSocket') || 
          message.includes('socket.io') ||
          fullMessage.includes('ws://127.0.0.1:6001') ||
          fullMessage.includes('ws://localhost:6001') ||
          allArgs.includes('WebSocket') ||
          allArgs.includes('socket.io');
        
        if (!isWebSocketWarning) {
          originalWarn.apply(console, args);
        }
        // Suppress WebSocket warnings silently
      };

      try {
        // Suppress errors at the window level before creating socket
        const originalWindowError = window.onerror;
        const originalWindowUnhandledRejection = window.onunhandledrejection;
        
        window.onerror = (message, source, lineno, colno, error) => {
          const msg = String(message || '');
          if (msg.includes('WebSocket') || msg.includes('socket.io') || msg.includes('ERR_CONNECTION_REFUSED')) {
            // Suppress WebSocket errors at window level
            return true;
          }
          if (originalWindowError) {
            return originalWindowError(message, source, lineno, colno, error);
          }
          return false;
        };
        
        window.onunhandledrejection = (event) => {
          const reason = String(event.reason || '');
          if (reason.includes('WebSocket') || reason.includes('socket.io') || reason.includes('ERR_CONNECTION_REFUSED')) {
            event.preventDefault();
            return true;
          }
          if (originalWindowUnhandledRejection) {
            return originalWindowUnhandledRejection(event);
          }
          return false;
        };
        
        this.socket = io(websocketUrl, {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          timeout: 5000, // Reduced timeout to fail faster
          forceNew: true,
          reconnection: false, // We'll handle reconnection manually
          autoConnect: true,
        });

        // Suppress socket.io internal error logging
        this.socket.io.on('error', () => {
          // Silently handle connection errors - they're expected when server is down
        });
        
        // Suppress connection error events
        this.socket.on('connect_error', () => {
          // Silently handled - expected when server is down
        });
        
        // Restore window error handlers after a short delay
        setTimeout(() => {
          if (originalWindowError) window.onerror = originalWindowError;
          if (originalWindowUnhandledRejection) window.onunhandledrejection = originalWindowUnhandledRejection;
        }, 100);
      } catch (error) {
        // Silent catch - connection errors are expected
      } finally {
        // Always restore console methods after a short delay to catch any late errors
        setTimeout(() => {
          console.error = originalError;
          console.warn = originalWarn;
        }, 200);
      }

      this.setupEventListeners();
    } catch (error) {
      // Only log errors in development mode
      if (import.meta.env.DEV && this.reconnectAttempts === 0) {
        console.error('Failed to initialize WebSocket connection:', error);
      }
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log('WebSocket connected:', this.socket?.id);
      }
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.hasLoggedError = false; // Reset error log flag on successful connection
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected, don't try to reconnect automatically
        if (import.meta.env.DEV) {
          console.log('WebSocket disconnected by server');
        }
        this.isConnecting = false;
      } else {
        // Client-side disconnect or network error, try to reconnect
        this.isConnecting = false;
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      // Suppress connection error logs - they're expected when server is down
      // Only log in development mode and only on first few attempts
      if (import.meta.env.DEV && this.reconnectAttempts === 0) {
        // Silent - connection errors are expected when server is not running
      }
      this.handleReconnect();
    });

    // Appointment notifications
    this.socket.on('appointment.created', (data: AppointmentNotification) => {
      this.emit('appointment-created', data);
      this.showNotification(data.message, 'success');
    });

    this.socket.on('appointment.updated', (data: AppointmentNotification) => {
      this.emit('appointment-updated', data);
      this.showNotification(data.message, 'info');
    });

    this.socket.on('appointment.cancelled', (data: AppointmentNotification) => {
      this.emit('appointment-cancelled', data);
      this.showNotification(data.message, 'warning');
    });

    this.socket.on('appointment.completed', (data: AppointmentNotification) => {
      this.emit('appointment-completed', data);
      this.showNotification(data.message, 'success');
    });

    // Inventory notifications
    this.socket.on('inventory.low_stock', (data: InventoryNotification) => {
      this.emit('inventory-low-stock', data);
      this.showNotification(data.message, 'error');
    });

    this.socket.on('inventory.restocked', (data: InventoryNotification) => {
      this.emit('inventory-restocked', data);
      this.showNotification(data.message, 'success');
    });

    this.socket.on('inventory.out_of_stock', (data: InventoryNotification) => {
      this.emit('inventory-out-of-stock', data);
      this.showNotification(data.message, 'error');
    });

    // General notifications
    this.socket.on('notification.general', (data: NotificationData) => {
      this.emit('general-notification', data);
      this.showNotification(data.message, 'info');
    });

    this.socket.on('notification.alert', (data: NotificationData) => {
      this.emit('alert-notification', data);
      this.showNotification(data.message, 'warning');
    });

    this.socket.on('notification.urgent', (data: NotificationData) => {
      this.emit('urgent-notification', data);
      this.showNotification(data.message, 'error');
    });

    // Eyewear condition notifications
    this.socket.on('eyewear.condition_assessment', (data: EyewearConditionNotification) => {
      this.emit('eyewear-condition-notification', data);
      const notificationType = data.priority === 'urgent' ? 'error' : 
                              data.priority === 'high' ? 'warning' : 'info';
      this.showNotification(data.message, notificationType);
    });

    // Prescription notifications
    this.socket.on('prescription.created', (data: PrescriptionNotification) => {
      this.emit('prescription-created', data);
      this.showNotification(data.message || 'Your prescription has been created', 'success');
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (!this.hasLoggedError) {
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.warn('WebSocket server is not available. Real-time features will be unavailable. The application will continue to work normally.');
        }
        this.hasLoggedError = true;
      }
      // Disable further reconnection attempts silently
      this.connectionDisabled = true;
      return;
    }

    this.reconnectAttempts++;
    // Only log in development mode and only first attempt
    if (import.meta.env.DEV && this.reconnectAttempts === 1) {
      // Silent - connection attempts are expected
    }

    setTimeout(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connect();
      }
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
  }

  private showNotification(message: string, type: 'success' | 'info' | 'warning' | 'error'): void {
    // Import toast dynamically to avoid circular dependencies
    import('sonner').then(({ toast }) => {
      switch (type) {
        case 'success':
          toast.success(message);
          break;
        case 'info':
          toast.info(message);
          break;
        case 'warning':
          toast.warning(message);
          break;
        case 'error':
          toast.error(message);
          break;
      }
    }).catch(() => {
      // Fallback to console if toast is not available
      console.log(`[${type.toUpperCase()}] ${message}`);
    });
  }

  // Event emitter functionality
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Public methods
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public reconnect(): void {
    if (this.connectionDisabled) {
      console.warn('WebSocket is disabled');
      return;
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.hasLoggedError = false;
    this.isConnecting = false;
    this.connect();
  }

  public enable(): void {
    if (this.connectionDisabled) {
      this.connectionDisabled = false;
      this.reconnectAttempts = 0;
      this.hasLoggedError = false;
      this.connect();
    }
  }

  public disable(): void {
    this.connectionDisabled = true;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Join specific channels
  public joinChannel(channel: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join', channel);
    }
  }

  public leaveChannel(channel: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave', channel);
    }
  }

  // Send custom events
  public emitEvent(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
export type { NotificationData, AppointmentNotification, InventoryNotification, PrescriptionNotification };
