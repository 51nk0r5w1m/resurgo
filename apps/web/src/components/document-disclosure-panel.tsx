"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type Member = { id: string; name: string; role: string };
type Document = { id: string; title: string };
type Disclosure = {
  documentId: string;
  documentTitle: string;
  operation: string;
  professionalName: string;
  purpose: string;
  recipientCaseMembershipId: string;
  status: string;
};

export function DocumentDisclosurePanel({
  caseId,
  disclosures,
  documents,
  professionals,
}: {
  caseId: string;
  disclosures: Disclosure[];
  documents: Document[];
  professionals: Member[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/disclosures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "authorize",
          documentId: form.get("documentId"),
          operations: form.getAll("operations"),
          purpose: form.get("purpose"),
          recipientCaseMembershipId: form.get("membershipId"),
        }),
      });
      if (!response.ok) throw new Error("authorize failed");
      setMessage(
        "Disclosure authorized for only the selected document and operations.",
      );
      router.refresh();
    } catch {
      setMessage("The disclosure could not be authorized.");
    } finally {
      setPending(false);
    }
  }
  async function revoke(documentId: string, recipientCaseMembershipId: string) {
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/disclosures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          documentId,
          recipientCaseMembershipId,
        }),
      });
      if (!response.ok) throw new Error("revoke failed");
      setMessage(
        "Consent and dependent document access were revoked immediately.",
      );
      router.refresh();
    } catch {
      setMessage("The disclosure could not be revoked.");
    } finally {
      setPending(false);
    }
  }
  const active = disclosures.filter(({ status }) => status === "active");
  return (
    <section className="workspace-card collaboration-action-card">
      <p className="eyebrow">Client-controlled document disclosure</p>
      <h2>Share one document for one stated purpose</h2>
      {professionals.length && documents.length ? (
        <form className="disclosure-form" onSubmit={authorize}>
          <label>
            <span>Professional</span>
            <select name="membershipId" required>
              <option value="">Choose a case professional</option>
              {professionals.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Document</span>
            <select name="documentId" required>
              <option value="">Choose a document</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </label>
          <label className="disclosure-purpose">
            <span>Purpose</span>
            <input
              maxLength={1000}
              name="purpose"
              placeholder="For example: review the current mortgage obligation"
              required
            />
          </label>
          <fieldset>
            <legend>Allowed operations</legend>
            <label>
              <input
                defaultChecked
                name="operations"
                type="checkbox"
                value="view"
              />{" "}
              Preview
            </label>
            <label>
              <input name="operations" type="checkbox" value="download" />{" "}
              Download
            </label>
            <label>
              <input name="operations" type="checkbox" value="contribute" />{" "}
              Contribute review work
            </label>
          </fieldset>
          <button
            className="button button-primary"
            disabled={pending}
            type="submit"
          >
            Authorize disclosure
          </button>
        </form>
      ) : (
        <p>
          Accept a verified professional invitation and upload an available
          document before creating a disclosure.
        </p>
      )}
      {active.length > 0 && (
        <div className="active-disclosures">
          <h3>Active disclosures</h3>
          {active.map((item) => (
            <article
              key={`${item.documentId}-${item.recipientCaseMembershipId}-${item.operation}`}
            >
              <div>
                <strong>{item.documentTitle}</strong>
                <p>
                  {item.professionalName} · {item.operation} · {item.purpose}
                </p>
              </div>
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() =>
                  revoke(item.documentId, item.recipientCaseMembershipId)
                }
                type="button"
              >
                Revoke access
              </button>
            </article>
          ))}
        </div>
      )}
      <p aria-live="polite" className="form-message">
        {message}
      </p>
    </section>
  );
}
