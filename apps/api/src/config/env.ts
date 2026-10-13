import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 chars'),
  CLIENT_URL: z.string().url().transform((u) => u.replace(/\/+$/, '')), // CORS compares origins as exact strings: a trailing slash would silently break it
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
  OBJECT_STORAGE_REGION: z.string().default('auto'),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(), // set for R2 / MinIO / other S3-compatible stores
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Finova <no-reply@finova.local>'),
}).superRefine((v, ctx) => {
  if (v.STORAGE_DRIVER !== 's3') return;
  for (const k of ['OBJECT_STORAGE_BUCKET', 'OBJECT_STORAGE_ACCESS_KEY_ID', 'OBJECT_STORAGE_SECRET_ACCESS_KEY'] as const)
    if (!v[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'required when STORAGE_DRIVER=s3' });
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print variable names only — never values.
  const bad = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  console.error(`Invalid environment configuration:\n  ${bad}`);
  process.exit(1);
}
export const env = parsed.data;
