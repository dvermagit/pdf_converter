// TypeScript interfaces matching the backend models and API responses

export type CampaignStatus =
  | 'validating'
  | 'validated'
  | 'processing'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RecipientStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
}

export interface ValidationError {
  row: number;
  column: string;
  value: string;
  reason: string;
}

export type CampaignSource = 'excel' | 'manual';

export interface Campaign {
  _id: string;
  name: string;
  originalFileName: string;
  masterFilePath: string;
  source: CampaignSource;
  templateId?: string;
  eventDate?: string;
  recurrence?: Recurrence;
  status: CampaignStatus;
  timezone: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  columnMapping: Record<string, string>;
  selectedOutputColumns: string[];
  validationErrors: ValidationError[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}


export interface Recipient {
  _id: string;
  campaignId: string;
  recipientName: string;
  phoneNumber: string;
  dateOfBirth?: string;
  message: string;
  scheduledAt: string;
  timezone: string;
  generatedFilePath: string;
  status: RecipientStatus;
  whatsappMessageId?: string;
  errorMessage?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  sentToday: number;
  deliveryRate: number;
}

export interface UploadResponse {
  campaign: Campaign;
  headers?: string[];
  validation?: {
    isValid: boolean;
    headers: string[];
    preview: Array<{ rowNumber: number; data: Record<string, unknown> }>;
    errors: ValidationError[];
    totalRows: number;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ColumnMapping {
  recipientName: string;
  phoneNumber: string;
  dateOfBirth: string;
  message: string;
  scheduledAt: string;
  [key: string]: string;
}

// ── Templates ───────────────────────────────────────────
export interface Template {
  _id: string;
  name: string;
  occasion: string;
  description: string;
  messageBody: string;
  eventDate?: string;
  defaultSendTime: string;
  timezone: string;
  emoji: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatePreset {
  key: string;
  name: string;
  occasion: string;
  emoji: string;
  description: string;
  messageBody: string;
  defaultSendTime: string;
}

export interface TemplateInput {
  name: string;
  occasion?: string;
  description?: string;
  messageBody: string;
  eventDate?: string | null;
  defaultSendTime?: string;
  timezone?: string;
  emoji?: string;
}

// ── Manual (form-based) campaigns ───────────────────────
export interface ManualRecipientInput {
  name: string;
  phone: string;
  dateOfBirth?: string;
  message?: string;
  scheduledAt?: string;
}

/** "Send every day from startDate to endDate at this local time." */
export interface DailyRepeat {
  mode: 'daily';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, inclusive
  time: string; // HH:mm
}

export interface Recurrence extends DailyRepeat {}

export interface ManualCampaignInput {
  name: string;
  templateId?: string;
  message?: string;
  eventName?: string;
  eventDate?: string;
  sendTime?: string;
  scheduledAt?: string;
  sendNow?: boolean;
  repeat?: DailyRepeat;
  timezone: string;
  recipients: ManualRecipientInput[];
  startNow?: boolean;
}

export interface ImportedContact {
  name: string;
  phone: string;
  dateOfBirth: string;
  /** Per-person send time read from the sheet, if it had one. */
  scheduledAt: string;
}

export interface ContactColumnMapping {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  scheduledAt?: string;
}

export interface ContactImportResponse {
  contacts: ImportedContact[];
  headers: string[];
  detected: ContactColumnMapping;
  /** A column was identified from its cell contents rather than its header. */
  detectedByContent: boolean;
  skippedRows: number;
  truncated: boolean;
}

/** 400 body when a sheet's columns could not be matched automatically. */
export interface ContactImportError {
  error: string;
  headers: string[];
  detected: ContactColumnMapping;
}

export interface ManualPreviewResponse {
  isValid: boolean;
  recipients: Array<{
    recipientName: string;
    phoneNumber: string;
    message: string;
    scheduledAt: string;
  }>;
  /** Total messages that will be sent (people × days). */
  totalRecipients: number;
  peopleCount: number;
  messagesPerPerson: number;
  firstSendAt?: string;
  lastSendAt?: string;
  errors: ValidationError[];
}

export interface SettingsResponse {
  whatsapp: {
    configured: boolean;
    phoneNumberId: string | null;
    apiVersion: string;
    webhookVerifyToken: string | null;
  };
  email: {
    configured: boolean;
    smtpHost: string;
    from: string;
  };
  limits: {
    maxRecipientsPerCampaign: number;
    maxUploadSizeMB: number;
    defaultTimezone: string;
  };
}
