import { AuthForm } from "../../components/auth-form";
import { AuthShell } from "../../components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
