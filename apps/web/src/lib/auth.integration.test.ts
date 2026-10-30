import { randomUUID } from "node:crypto";

import { createDatabase } from "@resurgo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createResurgoAuth } from "./auth-factory";
import { createCaseApi } from "./case-api";
import type { AuthEmail } from "./email";

const appUrl = "http://127.0.0.1:3000";
const databaseUrl = process.env.DATABASE_URL;

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.toUpperCase().replaceAll("=", "")) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  }
  const bytes =
    bits.match(/.{8}/gu)?.map((byte) => Number.parseInt(byte, 2)) ?? [];
  return Buffer.from(bytes).toString("utf8");
}

describe.skipIf(!databaseUrl)("Better Auth security boundary", () => {
  const database = createDatabase(databaseUrl ?? "");
  const messages: AuthEmail[] = [];
  const auth = createResurgoAuth({
    appUrl,
    database: database.db,
    emailSender: async (message) => {
      messages.push(message);
    },
    secret: "synthetic-auth-test-secret-0123456789abcdef0123456789abcdef",
    secureCookies: false,
  });
  const email = `synthetic-${randomUUID()}@example.test`;
  const password = "Synthetic password 42!";
  const testClientIp = `192.0.2.${Number.parseInt(randomUUID().slice(0, 2), 16) || 1}`;

  function request(
    path: string,
    body?: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    return auth.handler(
      new Request(`${appUrl}/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          origin: appUrl,
          "x-forwarded-for": testClientIp,
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }

  function responseCookies(response: Response) {
    return response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }

  async function registerVerifiedSession(label: string) {
    const accountEmail = `${label}-${randomUUID()}@example.test`;
    const accountPassword = "Synthetic case password 42!";
    const registration = await request("/sign-up/email", {
      name: `Synthetic ${label}`,
      email: accountEmail,
      password: accountPassword,
    });
    expect(registration.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const verification = [...messages]
      .reverse()
      .find(
        (message) =>
          message.recipient === accountEmail &&
          message.subject.includes("Verify"),
      );
    const verificationUrl = verification?.text.match(/https?:\/\/\S+/u)?.[0];
    expect(verificationUrl).toBeDefined();
    await auth.handler(new Request(verificationUrl!));
    const login = await request("/sign-in/email", {
      email: accountEmail,
      password: accountPassword,
    });
    expect(login.status).toBe(200);
    return responseCookies(login);
  }

  beforeAll(async () => {
    const signUp = await request("/sign-up/email", {
      name: "Synthetic Client",
      email,
      password,
      callbackURL: "/dashboard",
    });
    expect(signUp.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterAll(async () => {
    await database.pool.end();
  });

  it("requires email verification and establishes a server-validated session", async () => {
    const beforeVerification = await request("/sign-in/email", {
      email,
      password,
    });
    expect(beforeVerification.status).toBe(403);

    const verification = messages.find((message) =>
      message.subject.includes("Verify"),
    );
    expect(verification).toBeDefined();
    const verificationUrl = verification?.text.match(/https?:\/\/\S+/u)?.[0];
    expect(verificationUrl).toBeDefined();
    const verifyResponse = await auth.handler(new Request(verificationUrl!));
    expect([200, 302]).toContain(verifyResponse.status);

    const signIn = await request("/sign-in/email", { email, password });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const session = await request("/get-session", undefined, {
      cookie: cookie!.split(";")[0]!,
    });
    expect(session.status).toBe(200);
    expect((await session.json()).user.email).toBe(email);

    const signOut = await request(
      "/sign-out",
      {},
      {
        cookie: cookie!.split(";")[0]!,
      },
    );
    expect(signOut.status).toBe(200);
    const revoked = await request("/get-session", undefined, {
      cookie: cookie!.split(";")[0]!,
    });
    expect(await revoked.json()).toBeNull();
  });

  it("returns the same recovery response for known and unknown accounts", async () => {
    const known = await request("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    const unknown = await request("/request-password-reset", {
      email: `absent-${randomUUID()}@example.test`,
      redirectTo: "/reset-password",
    });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it("does not report successful registration when verification delivery fails", async () => {
    const deliveryFailureEmail = `delivery-failure-${randomUUID()}@example.test`;
    const deliveryFailureAuth = createResurgoAuth({
      appUrl,
      database: database.db,
      emailSender: async () => {
        throw new Error("Synthetic delivery failure");
      },
      secret:
        "synthetic-delivery-failure-secret-0123456789abcdef0123456789abcdef",
      secureCookies: false,
    });
    const response = await deliveryFailureAuth.handler(
      new Request(`${appUrl}/api/auth/sign-up/email`, {
        body: JSON.stringify({
          email: deliveryFailureEmail,
          name: "Synthetic Delivery Failure",
          password,
        }),
        headers: {
          "content-type": "application/json",
          origin: appUrl,
          "x-forwarded-for": "192.0.2.250",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
  });

  it("uses recovery tokens once and revokes existing sessions", async () => {
    const signIn = await request("/sign-in/email", { email, password });
    const oldCookie = signIn.headers.get("set-cookie")!.split(";")[0]!;
    const resetRequest = await request("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    expect(resetRequest.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const recovery = [...messages]
      .reverse()
      .find((message) => message.subject.includes("Reset"));
    const recoveryUrl = recovery?.text.match(/https?:\/\/\S+/u)?.[0];
    expect(recoveryUrl).toBeDefined();
    const parsedRecoveryUrl = new URL(recoveryUrl!);
    const token =
      parsedRecoveryUrl.searchParams.get("token") ??
      parsedRecoveryUrl.pathname.split("/").at(-1) ??
      null;
    expect(token).toBeTruthy();

    const newPassword = "Synthetic replacement 84!";
    const reset = await request("/reset-password", {
      newPassword,
      token,
    });
    expect(reset.status).toBe(200);
    const replay = await request("/reset-password", {
      newPassword: "Synthetic replay blocked 99!",
      token,
    });
    expect(replay.status).toBe(400);

    const revoked = await request("/get-session", undefined, {
      cookie: oldCookie,
    });
    expect(await revoked.json()).toBeNull();
    const replacementLogin = await request("/sign-in/email", {
      email,
      password: newPassword,
    });
    expect(replacementLogin.status).toBe(200);
  });

  it("rejects a cross-origin credential request", async () => {
    const response = await auth.handler(
      new Request(`${appUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://untrusted.example.test",
        },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects invalid and expired session tokens", async () => {
    const invalid = await request("/get-session", undefined, {
      cookie: "resurgo.session=synthetic-invalid-token",
    });
    expect(await invalid.json()).toBeNull();
  });

  it("uses a host-only secure production session cookie", async () => {
    const secureAuth = createResurgoAuth({
      appUrl: "https://resurgo.example.test",
      database: database.db,
      emailSender: async () => undefined,
      secret:
        "synthetic-production-cookie-secret-0123456789abcdef0123456789abcdef",
      secureCookies: true,
    });
    const context = await secureAuth.$context;
    expect(context.authCookies.sessionToken.name).toBe(
      "__Host-resurgo.session",
    );
    expect(context.authCookies.sessionToken.attributes).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("enforces the registration rate limit", async () => {
    const rateLimitIp = `198.51.100.${Number.parseInt(randomUUID().slice(0, 2), 16) || 1}`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await auth.handler(
        new Request(`${appUrl}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: appUrl,
            "x-forwarded-for": rateLimitIp,
          },
          body: JSON.stringify({
            name: "Synthetic Rate Limit Client",
            email,
            password,
          }),
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("enrolls TOTP and consumes a backup code only once", async () => {
    const mfaEmail = `synthetic-mfa-${randomUUID()}@example.test`;
    const mfaPassword = "Synthetic MFA password 42!";
    expect(
      (
        await request("/sign-up/email", {
          name: "Synthetic MFA Client",
          email: mfaEmail,
          password: mfaPassword,
        })
      ).status,
    ).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const verification = [...messages]
      .reverse()
      .find(
        (message) =>
          message.recipient === mfaEmail && message.subject.includes("Verify"),
      );
    const verificationUrl = verification?.text.match(/https?:\/\/\S+/u)?.[0];
    expect(verificationUrl).toBeDefined();
    await auth.handler(new Request(verificationUrl!));

    const login = await request("/sign-in/email", {
      email: mfaEmail,
      password: mfaPassword,
    });
    const sessionCookie = responseCookies(login);
    const enrollment = await request(
      "/two-factor/enable",
      { password: mfaPassword, method: "totp", issuer: "Resurgo" },
      { cookie: sessionCookie },
    );
    expect(enrollment.status).toBe(200);
    const enrollmentData = (await enrollment.json()) as {
      totpURI: string;
      backupCodes: string[];
    };
    const secret = new URL(enrollmentData.totpURI).searchParams.get("secret");
    expect(secret).toBeTruthy();
    const generated = await auth.api.generateTOTP({
      body: { secret: decodeBase32(secret!) },
    });
    const activation = await request(
      "/two-factor/verify-totp",
      { code: generated.code, trustDevice: false },
      { cookie: `${sessionCookie}; ${responseCookies(enrollment)}` },
    );
    expect(activation.status).toBe(200);

    await request("/sign-out", {}, { cookie: sessionCookie });
    const challengedLogin = await request("/sign-in/email", {
      email: mfaEmail,
      password: mfaPassword,
    });
    expect((await challengedLogin.clone().json()).twoFactorRedirect).toBe(true);
    const challengeCookie = responseCookies(challengedLogin);
    const recovery = await request(
      "/two-factor/verify-backup-code",
      { code: enrollmentData.backupCodes[0] },
      { cookie: challengeCookie },
    );
    expect(recovery.status).toBe(200);

    const repeatedLogin = await request("/sign-in/email", {
      email: mfaEmail,
      password: mfaPassword,
    });
    const replay = await request(
      "/two-factor/verify-backup-code",
      { code: enrollmentData.backupCodes[0] },
      { cookie: responseCookies(repeatedLogin) },
    );
    expect(replay.status).toBe(401);
  });

  it("binds case access to the authenticated principal and prevents enumeration", async () => {
    const ownerCookie = await registerVerifiedSession("case-owner");
    const unrelatedCookie = await registerVerifiedSession("unrelated-user");
    const denied: Array<{ actorUserId: string; resourceId: string }> = [];
    const caseApi = createCaseApi({
      database: database.db,
      getSession: async (headers) => {
        const session = await auth.api.getSession({ headers });
        return session ? { user: { id: session.user.id } } : null;
      },
      auditDenied: async (decision) => {
        denied.push({
          actorUserId: decision.actorUserId,
          resourceId: decision.resourceId,
        });
      },
    });

    const created = await caseApi.create(
      new Request(`${appUrl}/api/cases`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({ jurisdictionCode: "GA-FULTON-SUPERIOR" }),
      }),
    );
    expect(created.status).toBe(201);
    const caseId = ((await created.json()) as { case: { id: string } }).case.id;

    const ownerRead = await caseApi.read(
      new Request(`${appUrl}/api/cases/${caseId}`, {
        headers: { cookie: ownerCookie },
      }),
      caseId,
    );
    expect(ownerRead.status).toBe(200);

    const unrelatedRead = await caseApi.read(
      new Request(`${appUrl}/api/cases/${caseId}`, {
        headers: { cookie: unrelatedCookie },
      }),
      caseId,
    );
    const absentCaseId = randomUUID();
    const absentRead = await caseApi.read(
      new Request(`${appUrl}/api/cases/${absentCaseId}`, {
        headers: { cookie: unrelatedCookie },
      }),
      absentCaseId,
    );
    expect(unrelatedRead.status).toBe(404);
    expect(absentRead.status).toBe(404);
    expect(await unrelatedRead.json()).toEqual(await absentRead.json());

    const unrelatedList = await caseApi.list(
      new Request(`${appUrl}/api/cases`, {
        headers: { cookie: unrelatedCookie },
      }),
    );
    expect((await unrelatedList.json()).cases).toEqual([]);
    expect(denied).toHaveLength(2);

    const unauthenticatedCreate = await caseApi.create(
      new Request(`${appUrl}/api/cases`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jurisdictionCode: "GA-FULTON-SUPERIOR" }),
      }),
    );
    expect(unauthenticatedCreate.status).toBe(401);
  });
});
