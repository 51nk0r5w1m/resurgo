import { AuthForm } from "../../components/auth-form";
import { AuthShell } from "../../components/auth-shell";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell eyebrow="Account recovery" title="Choose a new password">
      <AuthForm mode="reset" resetToken={token} />
    </AuthShell>
  );
}
