"use client";

import { type FormEvent, useState } from "react";

import { authClient } from "../lib/auth-client";

export function MfaEnrollment() {
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    const result = await authClient.twoFactor.enable({
      password,
      method: "totp",
      issuer: "Resurgo",
    });
    if (result.error || result.data?.method !== "totp") {
      setMessage("Two-step enrollment could not be started.");
      return;
    }
    setTotpUri(result.data.totpURI);
    setBackupCodes(result.data.backupCodes);
    setMessage("Add the setup key to your authenticator, then verify a code.");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const result = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: false,
    });
    setMessage(
      result.error
        ? "That code was not valid. Two-step verification remains disabled."
        : "Two-step verification is active. Store the recovery codes offline.",
    );
  }

  return (
    <div>
      {!totpUri ? (
        <form className="auth-form" onSubmit={begin}>
          <label>
            Confirm your password
            <input
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </label>
          <button className="button button-primary" type="submit">
            Begin enrollment
          </button>
        </form>
      ) : (
        <>
          <p className="setup-key">
            <strong>Authenticator setup URI</strong>
            <br />
            {totpUri}
          </p>
          <form className="auth-form" onSubmit={verify}>
            <label>
              Six-digit code
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                name="code"
                required
              />
            </label>
            <button className="button button-primary" type="submit">
              Activate two-step verification
            </button>
          </form>
          <section aria-label="Recovery codes">
            <h3>Recovery codes</h3>
            <ul className="recovery-codes">
              {backupCodes.map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <div aria-live="polite" className="form-message">
        {message}
      </div>
    </div>
  );
}
