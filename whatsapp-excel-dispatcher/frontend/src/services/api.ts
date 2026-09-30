import axios from 'axios';
import type {
  AuthResponse,
  Campaign,
  ColumnMapping,
  ContactColumnMapping,
  ContactImportResponse,
  DashboardStats,
  ManualCampaignInput,
  ManualPreviewResponse,
  ManualRecipientInput,
  Pagination,
  Recipient,
  SettingsResponse,
  Template,
  TemplateInput,
  TemplatePreset,
  UploadResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Dev mode: skip auth if no token
  if (!token && import.meta.env.DEV) {
    config.headers['x-skip-auth'] = 'true';
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name });
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getStoredUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// ── Campaigns ───────────────────────────────────────────
export async function uploadCampaign(file: File, name?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  const { data } = await api.post<UploadResponse>('/campaigns/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function validateCampaign(
  campaignId: string,
  columnMapping: ColumnMapping,
  timezone: string,
  selectedOutputColumns: string[]
): Promise<UploadResponse> {
  const { data } = await api.post<UploadResponse>(`/campaigns/${campaignId}/validate`, {
    columnMapping,
    timezone,
    selectedOutputColumns,
  });
  return data;
}

export async function listCampaigns(
  page = 1,
  limit = 20,
  status?: string
): Promise<{ campaigns: Campaign[]; pagination: Pagination }> {
  const params: Record<string, unknown> = { page, limit };
  if (status) params.status = status;
  const { data } = await api.get('/campaigns', { params });
  return data;
}

export async function getCampaign(id: string): Promise<{ campaign: Campaign }> {
  const { data } = await api.get(`/campaigns/${id}`);
  return data;
}

export async function startCampaign(id: string): Promise<{ campaign: Campaign; scheduledCount: number }> {
  const { data } = await api.post(`/campaigns/${id}/start`);
  return data;
}

export async function cancelCampaign(id: string): Promise<{ campaign: Campaign; cancelledJobs: number }> {
  const { data } = await api.delete(`/campaigns/${id}`);
  return data;
}


// ── Templates ───────────────────────────────────────────
export async function listTemplates(): Promise<{ templates: Template[]; pagination: Pagination }> {
  const { data } = await api.get('/templates');
  return data;
}

export async function getTemplatePresets(): Promise<{
  presets: TemplatePreset[];
  placeholders: string[];
}> {
  const { data } = await api.get('/templates/presets');
  return data;
}

export async function createTemplate(
  input: TemplateInput & { presetKey?: string }
): Promise<{ template: Template }> {
  const { data } = await api.post('/templates', input);
  return data;
}

export async function updateTemplate(
  id: string,
  input: Partial<TemplateInput>
): Promise<{ template: Template }> {
  const { data } = await api.patch(`/templates/${id}`, input);
  return data;
}

export async function deleteTemplate(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/templates/${id}`);
  return data;
}

export async function previewTemplate(payload: {
  messageBody: string;
  name?: string;
  eventName?: string;
  eventDate?: string;
  dob?: string;
  timezone?: string;
}): Promise<{ rendered: string }> {
  const { data } = await api.post('/templates/preview', payload);
  return data;
}

// ── Manual campaigns ────────────────────────────────────
export async function createManualCampaign(
  input: ManualCampaignInput
): Promise<{ campaign: Campaign; scheduledCount: number }> {
  const { data } = await api.post('/campaigns/manual', input);
  return data;
}

export async function importContacts(
  file: File,
  columns?: ContactColumnMapping
): Promise<ContactImportResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (columns?.name) formData.append('nameColumn', columns.name);
  if (columns?.phone) formData.append('phoneColumn', columns.phone);
  if (columns?.dateOfBirth) formData.append('dobColumn', columns.dateOfBirth);
  if (columns?.scheduledAt) formData.append('scheduleColumn', columns.scheduledAt);

  const { data } = await api.post<ContactImportResponse>(
    '/campaigns/manual/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
}

export async function previewManualCampaign(
  input: Omit<ManualCampaignInput, 'name'>
): Promise<ManualPreviewResponse> {
  const { data } = await api.post('/campaigns/manual/preview', input);
  return data;
}

export async function addRecipients(
  campaignId: string,
  payload: {
    recipients: ManualRecipientInput[];
    message?: string;
    scheduledAt?: string;
    sendNow?: boolean;
  }
): Promise<{ campaign: Campaign; addedCount: number; scheduled: boolean }> {
  const { data } = await api.post(`/campaigns/${campaignId}/recipients`, payload);
  return data;
}

export async function removeRecipient(
  campaignId: string,
  recipientId: string
): Promise<{ success: boolean; campaign: Campaign }> {
  const { data } = await api.delete(`/campaigns/${campaignId}/recipients/${recipientId}`);
  return data;
}

// ── Recipients ──────────────────────────────────────────
export async function listRecipients(
  campaignId: string,
  page = 1,
  limit = 50,
  status?: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<{ recipients: Recipient[]; pagination: Pagination }> {
  const params: Record<string, unknown> = { page, limit };
  if (status) params.status = status;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  const { data } = await api.get(`/campaigns/${campaignId}/recipients`, { params });
  return data;
}

export async function retryRecipient(
  campaignId: string,
  recipientId: string
): Promise<{ recipient: Recipient }> {
  const { data } = await api.post(`/campaigns/${campaignId}/recipients/${recipientId}/retry`);
  return data;
}

// ── Dashboard ───────────────────────────────────────────
export async function getDashboardStats(): Promise<{
  stats: DashboardStats;
  recentCampaigns: Campaign[];
  upcomingDeliveries: Recipient[];
}> {
  const { data } = await api.get('/dashboard/stats');
  return data;
}

// ── Settings ────────────────────────────────────────────
export async function getSettings(): Promise<SettingsResponse> {
  const { data } = await api.get<SettingsResponse>('/settings');
  return data;
}

export async function testWhatsApp(): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
  const { data } = await api.post('/settings/test-whatsapp');
  return data;
}

export default api;
