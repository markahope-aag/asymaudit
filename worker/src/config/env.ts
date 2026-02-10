import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // Redis
  REDIS_URL: z.string().url(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // Google APIs
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Worker Service
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_API_KEY: z.string().min(1),

  // PageSpeed
  PAGESPEED_API_KEY: z.string().optional(),

  // SEO Tools
  MOZ_ACCESS_ID: z.string().optional(),
  MOZ_SECRET_KEY: z.string().optional(),
  SPYFU_API_KEY: z.string().optional(),
  SEMRUSH_API_KEY: z.string().optional(),

  // Notifications
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_EMAIL: z.string().email().optional(),

  // Rate Limiting
  GOOGLE_API_REQUESTS_PER_MINUTE: z.string().transform(Number).default('60'),
  WORDPRESS_API_REQUESTS_PER_MINUTE: z.string().transform(Number).default('30'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  process.exit(1);
}

export { env };