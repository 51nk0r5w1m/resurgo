import { z } from "zod";

const nonPlaceholderSecret = z
  .string()
  .min(24)
  .refine(
    (value) => !/^(change-me|replace-me|development-secret)/i.test(value),
    "must not use a documented placeholder",
  );

export const environmentSchema = z.object({
  BETTER_AUTH_SECRET: nonPlaceholderSecret.min(32),
  CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  DATABASE_URL: z.url().startsWith("postgresql://"),
  GARAGE_ACCESS_KEY_ID: z.string().startsWith("GK").min(18),
  GARAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  GARAGE_ENDPOINT: z.url(),
  GARAGE_REGION: z.string().min(1),
  GARAGE_SECRET_ACCESS_KEY: nonPlaceholderSecret,
  NEXT_PUBLIC_APP_URL: z.url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  POSTGRES_DB: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  POSTGRES_PASSWORD: nonPlaceholderSecret,
  POSTGRES_USER: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.email(),
});

export type Environment = z.infer<typeof environmentSchema>;

export const documentWorkerEnvironmentSchema = environmentSchema.pick({
  CLAMAV_HOST: true,
  CLAMAV_PORT: true,
  DATABASE_URL: true,
  GARAGE_ACCESS_KEY_ID: true,
  GARAGE_BUCKET: true,
  GARAGE_ENDPOINT: true,
  GARAGE_REGION: true,
  GARAGE_SECRET_ACCESS_KEY: true,
  NODE_ENV: true,
});

export type DocumentWorkerEnvironment = z.infer<
  typeof documentWorkerEnvironmentSchema
>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(input);
}

export function parseDocumentWorkerEnvironment(
  input: NodeJS.ProcessEnv,
): DocumentWorkerEnvironment {
  return documentWorkerEnvironmentSchema.parse(input);
}

export function formatEnvironmentError(error: z.ZodError): string {
  const fieldNames = [
    ...new Set(error.issues.map((issue) => issue.path.join("."))),
  ];
  return `Invalid environment configuration: ${fieldNames.join(", ")}`;
}
