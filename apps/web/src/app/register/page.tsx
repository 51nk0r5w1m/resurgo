import { AuthForm } from "../../components/auth-form";
import { AuthShell } from "../../components/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Individual-first" title="Create your private account">
      <AuthForm mode="register" />
    </AuthShell>
  );
}
