import { AuthForm } from "../../components/auth-form";
import { AuthShell } from "../../components/auth-shell";
import { isExternalDemoMode } from "../../lib/demo-mode";
import { redirect } from "next/navigation";

export default function RegisterPage() {
  if (isExternalDemoMode()) redirect("/login");
  return (
    <AuthShell eyebrow="Individual-first" title="Create your private account">
      <AuthForm mode="register" />
    </AuthShell>
  );
}
