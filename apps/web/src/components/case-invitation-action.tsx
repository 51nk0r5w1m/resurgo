"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CaseInvitationAction({
  caseId,
  membershipId,
}: {
  caseId: string;
  membershipId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function accept() {
    setPending(true);
    try {
      const response = await fetch(
        `/api/cases/${caseId}/memberships/${membershipId}`,
        { method: "PATCH" },
      );
      if (!response.ok) throw new Error("accept failed");
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch {
      setMessage("This invitation could not be accepted.");
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="button button-primary"
        disabled={pending}
        onClick={accept}
        type="button"
      >
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      <span aria-live="polite" className="form-message">
        {message}
      </span>
    </>
  );
}
