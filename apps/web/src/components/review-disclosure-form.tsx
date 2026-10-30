"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function ReviewDisclosureForm({
  attorneys,
  caseId,
  professionalReviewId,
}: {
  attorneys: { id: string; name: string }[];
  caseId: string;
  professionalReviewId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (attorneys.length === 0) return null;

  async function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/review-disclosures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          professionalReviewId,
          purpose: form.get("purpose"),
          recipientCaseMembershipId: form.get("membershipId"),
        }),
      });
      if (!response.ok) throw new Error("review disclosure failed");
      setMessage(
        "The attorney can now view this review, but not its undisclosed evidence.",
      );
      router.refresh();
    } catch {
      setMessage("The review findings could not be disclosed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="review-disclosure-form" onSubmit={authorize}>
      <h3>Authorize attorney access to these findings</h3>
      <p>
        This shares the review record only. Source documents remain restricted
        unless you disclose them separately.
      </p>
      <label>
        <span>Attorney</span>
        <select name="membershipId" required>
          <option value="">Choose an attorney</option>
          {attorneys.map((attorney) => (
            <option key={attorney.id} value={attorney.id}>
              {attorney.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Purpose</span>
        <input
          maxLength={1000}
          name="purpose"
          placeholder="Review financing conditions in the proposed settlement"
          required
        />
      </label>
      <button className="button button-secondary" disabled={pending}>
        Share review findings
      </button>
      <p aria-live="polite" className="form-message">
        {message}
      </p>
    </form>
  );
}
