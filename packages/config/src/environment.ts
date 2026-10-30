import { z } from "zod";

const nonPlaceholderSecret = z
  .string()
  .min(24)
  .refine(
    (value) => !/^(change-me|replace-me|development-secret)/i.test(value),
    "must not use a documented placeholder",
  );

export const environmentSchema = z.object({
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
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(input);
}

export function formatEnvironmentError(error: z.ZodError): string {
  const fieldNames = [
    ...new Set(error.issues.map((issue) => issue.path.join("."))),
  ];
  return `Invalid environment configuration: ${fieldNames.join(", ")}`;
}
