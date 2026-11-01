import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { type createDatabase } from "@resurgo/db";
import * as authSchema from "@resurgo/db/schema";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

import { recordAuthEvent } from "./auth-audit";
import type { AuthEmailSender } from "./email";

type Database = ReturnType<typeof createDatabase>["db"];

export function createResurgoAuth(input: {
  appUrl: string;
  database: Database;
  emailSender: AuthEmailSender;
  rateLimitEnabled?: boolean;
  secret: string;
  secureCookies: boolean;
  trustedOrigins?: string[];
}) {
  return betterAuth({
    appName: "Resurgo",
    baseURL: input.appUrl,
    secret: input.secret,
    database: drizzleAdapter(input.database, {
      provider: "pg",
      schema: authSchema,
      schemaName: "auth",
      transaction: true,
    }),
    advanced: {
      database: { generateId: false },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      // Custom names allow the stronger __Host- prefix in production. Better
      // Auth's automatic secure mode otherwise prepends __Secure- unconditionally.
      useSecureCookies: false,
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: input.secureCookies,
      },
      cookies: {
        session_token: {
          name: input.secureCookies
            ? "__Host-resurgo.session"
            : "resurgo.session",
          attributes: {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: input.secureCookies,
          },
        },
        two_factor: {
          name: input.secureCookies
            ? "__Host-resurgo.two_factor"
            : "resurgo.two_factor",
        },
        trust_device: {
          name: input.secureCookies
            ? "__Host-resurgo.trust_device"
            : "resurgo.trust_device",
        },
        dont_remember: {
          name: input.secureCookies
            ? "__Host-resurgo.dont_remember"
            : "resurgo.dont_remember",
        },
      },
    },
    trustedOrigins: input.trustedOrigins ?? [input.appUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        await input.emailSender({
          recipient: user.email,
          subject: "Reset your Resurgo password",
          text: `A password reset was requested for your Resurgo account. This link expires in 30 minutes and can be used once:\n\n${url}\n\nIf you did not request this, you can ignore this message.`,
        });
      },
      async onPasswordReset({ user }) {
        await recordAuthEvent(input.database, {
          action: "auth.password_reset.completed",
          actorUserId: user.id,
          outcome: "success",
        });
      },
    },
    emailVerification: {
      expiresIn: 30 * 60,
      autoSignInAfterVerification: false,
      async sendVerificationEmail({ user, url }) {
        await input.emailSender({
          recipient: user.email,
          subject: "Verify your Resurgo email",
          text: `Verify your email to activate your Resurgo account. This link expires in 30 minutes:\n\n${url}`,
        });
      },
      async afterEmailVerification(user) {
        await recordAuthEvent(input.database, {
          action: "auth.email_verified",
          actorUserId: user.id,
          outcome: "success",
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 30,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: input.rateLimitEnabled ?? true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 10 },
        "/send-verification-email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 5 },
        "/reset-password": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 10 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async after(user) {
            await recordAuthEvent(input.database, {
              action: "auth.account.registered",
              actorUserId: user.id,
              outcome: "success",
            });
          },
        },
      },
      session: {
        create: {
          async after(session) {
            await recordAuthEvent(input.database, {
              action: "auth.session.created",
              actorUserId: session.userId,
              outcome: "success",
            });
          },
        },
        delete: {
          async after(session) {
            await recordAuthEvent(input.database, {
              action: "auth.session.revoked",
              actorUserId: session.userId,
              outcome: "success",
            });
          },
        },
      },
    },
    plugins: [
      twoFactor({
        issuer: "Resurgo",
        skipVerificationOnEnable: false,
        backupCodeOptions: { amount: 10, length: 12 },
      }),
    ],
    logger: { disabled: true },
  });
}
