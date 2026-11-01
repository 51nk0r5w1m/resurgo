import { AuthForm } from "../../components/auth-form";
import { AuthShell } from "../../components/auth-shell";
import { isExternalDemoMode } from "../../lib/demo-mode";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in">
      <AuthForm mode="login" registrationEnabled={!isExternalDemoMode()} />
    </AuthShell>
  );
}
