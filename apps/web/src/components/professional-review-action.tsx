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
  settlement,
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
  settlement: {
    equityBuyoutAmount: string | null;
    existingMortgageResponsibility: string;
    financingAssumptions: string;
    lenderFindings: string | null;
    outstandingConditions: string | null;
    propertyDisposition: string;
    proposedPathway: string;
    proposedSettlementDeadline: string | null;
    reviewStage: string;
  } | null;
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
          ...(settlement
            ? {
                settlement: {
                  equityBuyoutAmount:
                    form.get("equityBuyoutAmount") || undefined,
                  existingMortgageResponsibility: form.get(
                    "existingMortgageResponsibility",
                  ),
                  financingAssumptions: form.get("financingAssumptions"),
                  lenderFindings: form.get("lenderFindings") || undefined,
                  outstandingConditions:
                    form.get("outstandingConditions") || undefined,
                  propertyDisposition: form.get("propertyDisposition"),
                  proposedPathway: form.get("proposedPathway"),
                  proposedSettlementDeadline:
                    form.get("proposedSettlementDeadline") || undefined,
                  reviewStage: "feasibility_review",
                },
              }
            : {}),
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

  async function acknowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/reviews`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "acknowledged",
          note: form.get("acknowledgementNote"),
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
          {settlement && (
            <fieldset className="settlement-review-fields">
              <legend>Settlement feasibility details</legend>
              <p>
                This records a financing feasibility review. It is not a
                preapproval, underwriting approval, or commitment to close.
              </p>
              <label>
                <span>Proposed property disposition</span>
                <select
                  defaultValue={settlement.propertyDisposition}
                  name="propertyDisposition"
                  required
                >
                  <option value="retain_by_client">
                    Client retains property
                  </option>
                  <option value="retain_by_spouse">
                    Spouse retains property
                  </option>
                  <option value="sell">Sell property</option>
                  <option value="undecided">Undecided</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <span>Proposed financing pathway</span>
                <select
                  defaultValue={settlement.proposedPathway}
                  name="proposedPathway"
                  required
                >
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
                <textarea
                  defaultValue={settlement.existingMortgageResponsibility}
                  name="existingMortgageResponsibility"
                  required
                  rows={2}
                />
              </label>
              <label>
                <span>Financing assumptions</span>
                <textarea
                  defaultValue={settlement.financingAssumptions}
                  name="financingAssumptions"
                  required
                  rows={2}
                />
              </label>
              <label>
                <span>Equity buyout amount, if proposed</span>
                <input
                  defaultValue={settlement.equityBuyoutAmount ?? ""}
                  inputMode="decimal"
                  name="equityBuyoutAmount"
                />
              </label>
              <label>
                <span>Proposed settlement deadline</span>
                <input
                  defaultValue={
                    settlement.proposedSettlementDeadline?.slice(0, 10) ?? ""
                  }
                  name="proposedSettlementDeadline"
                  type="date"
                />
              </label>
              <label>
                <span>Lender findings</span>
                <textarea
                  defaultValue={settlement.lenderFindings ?? ""}
                  name="lenderFindings"
                  rows={3}
                />
              </label>
              <label>
                <span>Outstanding financing conditions</span>
                <textarea
                  defaultValue={settlement.outstandingConditions ?? ""}
                  name="outstandingConditions"
                  rows={3}
                />
              </label>
            </fieldset>
          )}
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
        <form className="review-acknowledgement-form" onSubmit={acknowledge}>
          <label>
            <span>Attorney context for the client</span>
            <textarea
              name="acknowledgementNote"
              placeholder="Record how these conditions affect settlement language or timing."
              required
              rows={3}
            />
          </label>
          <button className="button button-secondary" disabled={pending}>
            Acknowledge this exact review
          </button>
        </form>
      )}
      <p aria-live="polite" className="form-message">
        {message}
      </p>
    </div>
  );
}
