import { AuthShell } from "../../components/auth-shell";
import { TwoFactorChallenge } from "../../components/two-factor-form";

export default function TwoFactorPage() {
  return (
    <AuthShell eyebrow="Account security" title="Two-step verification">
      <TwoFactorChallenge />
    </AuthShell>
  );
}
