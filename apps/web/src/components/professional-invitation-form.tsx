"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type Professional = {
  name: string;
  organizationMembershipId: string;
  organizationName: string;
  role: string;
  userId: string;
};

export function ProfessionalInvitationForm({
  caseId,
  professionals,
}: {
  caseId: string;
  professionals: Professional[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identifier = String(
      new FormData(event.currentTarget).get("professional"),
    );
    const professional = professionals.find(
      ({ organizationMembershipId }) => organizationMembershipId === identifier,
    );
    if (!professional) return;
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/memberships`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationMembershipId: professional.organizationMembershipId,
          role: professional.role,
          userId: professional.userId,
        }),
      });
      if (!response.ok) throw new Error("invite failed");
      setMessage(
        "Invitation created. No documents or restricted facts were shared.",
      );
      router.refresh();
    } catch {
      setMessage("The verified professional could not be invited.");
    } finally {
      setPending(false);
    }
  }
  if (!professionals.length) {
    return (
      <p>
        No additional verified pilot professionals are currently available for
        invitation.
      </p>
    );
  }
  return (
    <form className="professional-invite-form" onSubmit={submit}>
      <label>
        <span>Verified pilot professional</span>
        <select name="professional" required>
          <option value="">Choose a professional</option>
          {professionals.map((professional) => (
            <option
              key={professional.organizationMembershipId}
              value={professional.organizationMembershipId}
            >
              {professional.name} · {professional.organizationName} ·{" "}
              {professional.role}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating invitation…" : "Invite to case"}
      </button>
      <p aria-live="polite" className="form-message">
        {message}
      </p>
    </form>
  );
}
