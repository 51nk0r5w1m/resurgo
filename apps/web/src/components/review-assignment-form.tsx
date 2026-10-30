"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function ReviewAssignmentForm({
  caseId,
  documents,
  professionals,
  reviewTriggers,
}: {
  caseId: string;
  documents: Array<{
    id: string;
    title: string;
    versionId: string;
    versionNumber: number;
  }>;
  professionals: Array<{ id: string; name: string; role: string }>;
  reviewTriggers: Array<{ id: string; title: string }>;
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
          sourceDiscoveryOutputId: form.get("sourceDiscoveryOutputId"),
          settlement: {
            equityBuyoutAmount: form.get("equityBuyoutAmount") || undefined,
            existingMortgageResponsibility: form.get(
              "existingMortgageResponsibility",
            ),
            financingAssumptions: form.get("financingAssumptions"),
            propertyDisposition: form.get("propertyDisposition"),
            proposedPathway: form.get("proposedPathway"),
            proposedSettlementDeadline:
              form.get("proposedSettlementDeadline") || undefined,
            reviewStage: "feasibility_review",
          },
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
  if (!documents.length || !professionals.length || !reviewTriggers.length)
    return null;
  return (
    <section className="workspace-card collaboration-action-card">
      <p className="eyebrow">Settlement Feasibility Review</p>
      <h2>Test the housing proposal against visible evidence.</h2>
      <p>
        This is a coordination review—not a preapproval, underwriting approval,
        legal conclusion, or promise to close.
      </p>
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
          <span>Discovery review trigger</span>
          <select name="sourceDiscoveryOutputId" required>
            <option value="">Choose an outstanding trigger</option>
            {reviewTriggers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
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
          <span>Proposed property disposition</span>
          <select name="propertyDisposition" required>
            <option value="retain_by_client">
              Client proposes retaining the property
            </option>
            <option value="retain_by_spouse">
              Spouse proposes retaining the property
            </option>
            <option value="sell">Sell the property</option>
            <option value="undecided">Undecided</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Proposed financing pathway</span>
          <select name="proposedPathway" required>
            <option value="refinance">Refinance</option>
            <option value="assumption">Loan assumption</option>
            <option value="sale">Sale</option>
            <option value="payoff">Payoff</option>
            <option value="undecided">Undecided</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Existing mortgage responsibility</span>
          <textarea name="existingMortgageResponsibility" required rows={3} />
        </label>
        <label>
          <span>Financing assumptions to test</span>
          <textarea name="financingAssumptions" required rows={3} />
        </label>
        <label>
          <span>Equity buyout amount, if proposed</span>
          <input min="0" name="equityBuyoutAmount" step="0.01" type="number" />
        </label>
        <label>
          <span>Proposed settlement deadline</span>
          <input name="proposedSettlementDeadline" type="date" />
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
