"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "../lib/auth-client";

type Mode = "login" | "register" | "forgot" | "reset";

const genericRecoveryMessage =
  "If an account matches that address, a recovery message has been sent.";

export function AuthForm({
  mode,
  resetToken,
}: {
  mode: Mode;
  resetToken?: string | undefined;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(data.get("password") ?? "");

    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          name: String(data.get("name") ?? "").trim(),
          email,
          password,
          callbackURL: "/dashboard",
        });
        setMessage(
          result.error
            ? "We could not create that account. Check the details or try signing in."
            : "Check your local inbox to verify your email before signing in.",
        );
      } else if (mode === "login") {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/dashboard",
        });
        if (result.error) {
          setMessage(
            "The email, password, or verification state is not valid.",
          );
        } else if (
          result.data &&
          "twoFactorRedirect" in result.data &&
          result.data.twoFactorRedirect === true
        ) {
          router.push("/two-factor");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else if (mode === "forgot") {
        await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        setMessage(genericRecoveryMessage);
      } else {
        const token = resetToken;
        if (!token) {
          setMessage("This recovery link is missing or invalid.");
        } else {
          const result = await authClient.resetPassword({
            newPassword: password,
            token,
          });
          setMessage(
            result.error
              ? "This recovery link is invalid or expired. Request a new one."
              : "Password updated. All prior sessions have been revoked; sign in again.",
          );
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && (
        <label>
          Your name
          <input autoComplete="name" name="name" required />
        </label>
      )}
      {mode !== "reset" && (
        <label>
          Email address
          <input autoComplete="email" name="email" required type="email" />
        </label>
      )}
      {(mode === "login" || mode === "register" || mode === "reset") && (
        <label>
          {mode === "reset" ? "New password" : "Password"}
          <input
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={12}
            name="password"
            required
            type="password"
          />
          {mode !== "login" && <small>Use at least 12 characters.</small>}
        </label>
      )}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Working…"
          : mode === "login"
            ? "Sign in"
            : mode === "register"
              ? "Create private account"
              : mode === "forgot"
                ? "Send recovery link"
                : "Set new password"}
      </button>
      <div aria-live="polite" className="form-message" role="status">
        {message}
      </div>
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/register">Create an account</Link>
          </>
        ) : (
          <Link href="/login">Return to sign in</Link>
        )}
      </div>
    </form>
  );
}
