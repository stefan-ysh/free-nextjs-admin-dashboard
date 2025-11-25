export type CalendarEventCategory = 'meeting' | 'deadline' | 'reminder' | 'travel';

export interface CalendarEventRecord {
  id: string;
  title: string;
  calendar: CalendarEventCategory;
  start: string;
  end?: string;
  allDay: boolean;
  description?: string;
  location?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventInput = Omit<CalendarEventRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface CalendarEventPayload {
  title: string;
  calendar: CalendarEventCategory;
  start: string;
  end?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface CalendarApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
