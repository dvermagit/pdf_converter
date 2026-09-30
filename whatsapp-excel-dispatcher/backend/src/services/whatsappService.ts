import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const META_BASE_URL = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

interface MediaUploadResponse {
  id: string;
}

interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface WhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// Classify whether an API error is retryable
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    // 429 rate limit, 500+ server errors are retryable
    if (status && (status === 429 || status >= 500)) return true;
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    // WhatsApp-specific retryable error codes
    const waError = error.response?.data as WhatsAppError | undefined;
    if (waError?.error?.code) {
      const retryableCodes = [1, 2, 4, 17, 341]; // Temporary API errors, too many calls, app limit
      return retryableCodes.includes(waError.error.code);
    }
  }
  return false;
}

// Upload a document (Excel file) to WhatsApp media
export async function uploadMedia(filePath: string): Promise<string> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error('WhatsApp API credentials not configured');
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const response = await axios.post<MediaUploadResponse>(
    `${META_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
        ...form.getHeaders(),
      },
      timeout: 60000, // 60 second timeout for file upload
    }
  );

  logger.info({ mediaId: response.data.id, filePath }, 'Media uploaded to WhatsApp');
  return response.data.id;
}

// Send a WhatsApp message with a document attachment
export async function sendDocumentMessage(
  phoneNumber: string,
  mediaId: string,
  caption: string,
  filename: string
): Promise<string> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error('WhatsApp API credentials not configured');
  }

  // Strip the '+' from E.164 for Meta API
  const recipient = phoneNumber.replace('+', '');

  const response = await axios.post<SendMessageResponse>(
    `${META_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'document',
      document: {
        id: mediaId,
        caption,
        filename,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const messageId = response.data.messages[0]?.id;
  logger.info({ messageId, phoneNumber, filename }, 'WhatsApp document message sent');
  return messageId;
}

interface TemplateComponent {
  type: string;
  parameters: Array<Record<string, unknown>>;
}

export interface SendTemplateOptions {
  /** Media id for a template whose header is a document. */
  documentId?: string;
  filename?: string;
}

/**
 * Send an approved Meta message template.
 *
 * This is the only way to reach someone outside the 24-hour customer service
 * window, so it is what production campaigns use. The template must already be
 * approved, and `bodyParameters` must match the approved variable count exactly
 * — Meta rejects the message otherwise (error 132000).
 */
export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[],
  options: SendTemplateOptions = {}
): Promise<string> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error('WhatsApp API credentials not configured');
  }

  const recipient = phoneNumber.replace('+', '');
  const components: TemplateComponent[] = [];

  if (options.documentId) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: { id: options.documentId, filename: options.filename },
        },
      ],
    });
  }

  if (bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map((text) => ({ type: 'text', text })),
    });
  }

  const response = await axios.post<SendMessageResponse>(
    `${META_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const messageId = response.data.messages[0]?.id;
  logger.info(
    { messageId, phoneNumber, templateName, languageCode },
    'WhatsApp template message sent'
  );
  return messageId;
}

// Send a plain text WhatsApp message
export async function sendTextMessage(phoneNumber: string, text: string): Promise<string> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error('WhatsApp API credentials not configured');
  }

  const recipient = phoneNumber.replace('+', '');

  const response = await axios.post<SendMessageResponse>(
    `${META_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const messageId = response.data.messages[0]?.id;
  logger.info({ messageId, phoneNumber }, 'WhatsApp text message sent');
  return messageId;
}

// Test the WhatsApp API connection
export async function testConnection(): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
  try {
    if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
      return { success: false, error: 'WhatsApp API credentials not configured' };
    }

    const response = await axios.get(
      `${META_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}`,
      {
        headers: { Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}` },
        timeout: 10000,
      }
    );

    return {
      success: true,
      phoneNumber: response.data.display_phone_number || env.META_WA_PHONE_NUMBER_ID,
    };
  } catch (error) {
    const msg = error instanceof AxiosError ? error.response?.data?.error?.message || error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
