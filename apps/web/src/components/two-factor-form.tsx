"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "../lib/auth-client";

export function TwoFactorChallenge() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") ?? "").trim();
    const backup = data.get("backup") === "on";
    try {
      const result = backup
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setMessage("That verification code is not valid.");
        return;
      }
    } catch {
      setMessage("We couldn't verify your code. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Verification or backup code
        <input
          autoComplete="one-time-code"
          inputMode="numeric"
          name="code"
          required
        />
      </label>
      <label className="check-row">
        <input name="backup" type="checkbox" /> Use a recovery code
      </label>
      <button className="button button-primary" type="submit">
        Verify
      </button>
      <div aria-live="polite" className="form-message">
        {message}
      </div>
    </form>
  );
}
