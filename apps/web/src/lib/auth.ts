import "server-only";

import { parseEnvironment } from "@resurgo/config";
import { createDatabase } from "@resurgo/db";

import { createResurgoAuth } from "./auth-factory";
import { classifyAuthenticationResponse, recordAuthEvent } from "./auth-audit";
import { createSmtpEmailSender } from "./email";

let runtime:
  | {
      auth: ReturnType<typeof createResurgoAuth>;
      database: ReturnType<typeof createDatabase>;
    }
  | undefined;

function getRuntime() {
  if (runtime) return runtime;
  const environment = parseEnvironment(process.env);
  const database = createDatabase(environment.DATABASE_URL);
  runtime = {
    database,
    auth: createResurgoAuth({
      appUrl: environment.NEXT_PUBLIC_APP_URL,
      database: database.db,
      emailSender: createSmtpEmailSender({
        host: environment.SMTP_HOST,
        port: environment.SMTP_PORT,
        from: environment.SMTP_FROM,
      }),
      secret: environment.BETTER_AUTH_SECRET,
      secureCookies: environment.NODE_ENV === "production",
    }),
  };
  return runtime;
}

export function getAuth() {
  return getRuntime().auth;
}

export function getDatabase() {
  return getRuntime().database.db;
}

export async function auditAuthenticationResponse(
  request: Request,
  response: Response,
) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/u, "");
  const actionByPath: Record<string, string> = {
    "/sign-in/email": "auth.login",
    "/request-password-reset": "auth.password_reset.requested",
    "/send-verification-email": "auth.email_verification.requested",
  };
  const action = actionByPath[path];
  if (!action) return;

  const result = await classifyAuthenticationResponse(response);
  await recordAuthEvent(getRuntime().database.db, {
    action,
    ...result,
  });
}
