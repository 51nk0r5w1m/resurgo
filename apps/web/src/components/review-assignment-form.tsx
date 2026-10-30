"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function ReviewAssignmentForm({
  caseId,
  documents,
  professionals,
}: {
  caseId: string;
  documents: Array<{
    id: string;
    title: string;
    versionId: string;
    versionNumber: number;
  }>;
  professionals: Array<{ id: string; name: string; role: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const document = documents.find(
      ({ versionId }) => versionId === form.get("versionId"),
    );
    if (!document) return;
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decisionContext: form.get("decisionContext"),
          documentId: document.id,
          purpose: form.get("purpose"),
          responsibleCaseMembershipId: form.get("membershipId"),
          reviewScope: form.get("reviewScope"),
          versionId: document.versionId,
        }),
      });
      if (!response.ok) throw new Error("assignment failed");
      setMessage(
        "Review assigned against the exact selected evidence version.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Authorize preview and review contribution before assigning this review.",
      );
    } finally {
      setPending(false);
    }
  }
  if (!documents.length || !professionals.length) return null;
  return (
    <section className="workspace-card collaboration-action-card">
      <p className="eyebrow">Assign accountable review</p>
      <h2>No consequential decision without visible context.</h2>
      <form className="review-assignment-form" onSubmit={submit}>
        <label>
          <span>Responsible professional</span>
          <select name="membershipId" required>
            <option value="">Choose a professional</option>
            {professionals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Exact evidence version</span>
          <select name="versionId" required>
            <option value="">Choose evidence</option>
            {documents.map((item) => (
              <option key={item.versionId} value={item.versionId}>
                {item.title} · version {item.versionNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Decision context</span>
          <input
            name="decisionContext"
            placeholder="What decision will this review inform?"
            required
          />
        </label>
        <label>
          <span>Review scope</span>
          <textarea
            name="reviewScope"
            placeholder="Define what the professional should and should not assess."
            required
            rows={4}
          />
        </label>
        <label>
          <span>Evidence purpose</span>
          <input
            name="purpose"
            placeholder="Why this version is relevant"
            required
          />
        </label>
        <button
          className="button button-primary"
          disabled={pending}
          type="submit"
        >
          {pending ? "Assigning…" : "Assign review"}
        </button>
        <p aria-live="polite" className="form-message">
          {message}
        </p>
      </form>
    </section>
  );
}
