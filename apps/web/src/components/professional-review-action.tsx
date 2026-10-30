"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type Evidence = {
  documentId: string;
  documentVersionId: string;
  purpose: string;
};

export function ProfessionalReviewAction({
  canAcknowledge,
  canContribute,
  caseId,
  decisionContext,
  evidence,
  professionalReviewId,
  reviewRevisionId,
  reviewScope,
  statementHash,
  status,
}: {
  canAcknowledge: boolean;
  canContribute: boolean;
  caseId: string;
  decisionContext: string;
  evidence: Evidence[];
  professionalReviewId: string;
  reviewRevisionId: string;
  reviewScope: string;
  statementHash: string;
  status: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function revise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/reviews`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decisionContext,
          evidence,
          professionalReviewId,
          reviewScope,
          statements: form.get("body")
            ? [
                {
                  body: form.get("body"),
                  conditionStatus: form.get("conditionStatus"),
                  type: form.get("type"),
                },
              ]
            : [],
          status: form.get("status"),
        }),
      });
      if (!response.ok) throw new Error("review update failed");
      setMessage("The immutable review history was updated.");
      router.refresh();
    } catch {
      setMessage("This review transition could not be recorded.");
    } finally {
      setPending(false);
    }
  }

  async function acknowledge() {
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/reviews`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "acknowledged",
          professionalReviewId,
          reviewRevisionId,
          statementHash,
        }),
      });
      if (!response.ok) throw new Error("acknowledgement failed");
      setMessage("Attorney acknowledgement recorded against this revision.");
      router.refresh();
    } catch {
      setMessage("This revision could not be acknowledged.");
    } finally {
      setPending(false);
    }
  }

  const nextStatuses =
    status === "assigned"
      ? ["in_progress", "withdrawn"]
      : status === "in_progress" || status === "clarification_required"
        ? ["in_progress", "clarification_required", "completed", "withdrawn"]
        : [];
  return (
    <div className="review-action-panel">
      {canContribute && nextStatuses.length > 0 && (
        <form className="review-revision-form" onSubmit={revise}>
          <h3>Record the next review state</h3>
          <label>
            <span>Status</span>
            <select name="status" required>
              {nextStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Finding, condition, or question</span>
            <textarea name="body" rows={3} />
          </label>
          <label>
            <span>Statement type</span>
            <select name="type">
              <option value="finding">Finding</option>
              <option value="outstanding_condition">
                Outstanding condition
              </option>
              <option value="clarification_request">
                Clarification request
              </option>
            </select>
          </label>
          <label>
            <span>Condition state</span>
            <select name="conditionStatus">
              <option value="open">Open</option>
              <option value="satisfied">Satisfied</option>
              <option value="waived">Waived</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </label>
          <button className="button button-secondary" disabled={pending}>
            Save review revision
          </button>
        </form>
      )}
      {canAcknowledge && status === "completed" && (
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={acknowledge}
          type="button"
        >
          Acknowledge this exact review
        </button>
      )}
      <p aria-live="polite" className="form-message">
        {message}
      </p>
    </div>
  );
}
