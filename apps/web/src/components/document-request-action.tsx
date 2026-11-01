"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type AvailableVersion = {
  documentId: string;
  title: string;
  versionId: string;
  versionNumber: number;
};

export function DocumentRequestAction({
  availableVersions,
  caseId,
  linkedDocumentId,
  linkedVersionId,
  requestId,
  status,
}: {
  availableVersions: AvailableVersion[];
  caseId: string;
  linkedDocumentId: string | null;
  linkedVersionId: string | null;
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = availableVersions.find(
      ({ versionId }) => versionId === form.get("versionId"),
    );
    const nextStatus = status === "requested" ? "submitted" : "completed";
    const documentId = selected?.documentId ?? linkedDocumentId;
    const documentVersionId = selected?.versionId ?? linkedVersionId;
    if (!documentId || !documentVersionId) {
      setMessage("Choose an available document version.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/cases/${caseId}/document-requests/${requestId}`,
        {
          body: JSON.stringify({
            documentId,
            documentVersionId,
            status: nextStatus,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!response.ok) {
        setMessage("The request state could not be changed.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("The request service could not be reached.");
    } finally {
      setPending(false);
    }
  }

  if (status !== "requested" && status !== "submitted") return null;

  return (
    <form className="request-action" onSubmit={transition}>
      {status === "requested" && (
        <label>
          <span className="sr-only">Available document version</span>
          <select name="versionId" required>
            <option value="">Choose an available document</option>
            {availableVersions.map((version) => (
              <option key={version.versionId} value={version.versionId}>
                {version.title} · v{version.versionNumber}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="button button-secondary"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Saving…"
          : status === "requested"
            ? "Submit document"
            : "Mark complete"}
      </button>
      <span aria-live="polite">{message}</span>
    </form>
  );
}
