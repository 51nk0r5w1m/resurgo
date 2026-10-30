import { AuthForm } from "../../components/auth-form";
import { AuthShell } from "../../components/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password">
      <AuthForm mode="forgot" />
    </AuthShell>
  );
}
