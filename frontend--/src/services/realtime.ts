import { QueryClient } from '@tanstack/react-query';

type EventPayload = {
  id: number;
  type: string;
  payload: any;
  created_at: string;
};

export class RealtimeClient {
  private es: EventSource | null = null;
  private lastId: number = 0;

  constructor(private apiBaseUrl: string, private token: string, private queryClient: QueryClient) {}

  connect(branchId?: number) {
    if (this.es) return;
    const url = new URL(`${this.apiBaseUrl.replace(/\/$/, '')}/realtime/stream`);
    url.searchParams.set('since_id', String(this.lastId));
    url.searchParams.set('token', this.token);
    if (branchId) url.searchParams.set('branch_id', String(branchId));

    this.es = new EventSource(url.toString());

    this.es.addEventListener('appointment.created', (e) => this.onEvent(e as MessageEvent));
    this.es.addEventListener('prescription.created', (e) => this.onEvent(e as MessageEvent));
    this.es.onmessage = (e) => this.onEvent(e as MessageEvent);
    this.es.onerror = () => {
      this.disconnect();
      // simple backoff reconnect
      setTimeout(() => this.connect(branchId), 3000);
    };
  }

  private onEvent(e: MessageEvent) {
    try {
      const data: EventPayload = JSON.parse(e.data);
      this.lastId = data.id;
      switch (data.type) {
        case 'appointment.created':
          // invalidate appointments for all roles
          this.queryClient.invalidateQueries({ queryKey: ['appointments'] });
          break;
        case 'prescription.created':
          // Invalidate all prescription-related queries
          this.queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
          this.queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
          break;
        default:
          break;
      }
    } catch (_) {}
  }

  disconnect() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }
}



