import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),

  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('7d'),

  META_GRAPH_API_VERSION: z.string().default('v22.0'),
  META_WA_PHONE_NUMBER_ID: z.string().default(''),
  META_WA_ACCESS_TOKEN: z.string().default(''),
  META_WA_WEBHOOK_VERIFY_TOKEN: z.string().default(''),

  MAX_RECIPIENTS_PER_CAMPAIGN: z.coerce.number().default(1000),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  DEFAULT_CAMPAIGN_TIMEZONE: z.string().default('Asia/Kolkata'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().default(''),
  STORAGE_REGION: z.string().default(''),
  STORAGE_ACCESS_KEY: z.string().default(''),
  STORAGE_SECRET_KEY: z.string().default(''),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@example.com'),

  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
