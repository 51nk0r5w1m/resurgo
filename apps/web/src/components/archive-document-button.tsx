"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveDocumentButton({
  caseId,
  documentId,
}: {
  caseId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  async function archive() {
    const response = await fetch(
      `/api/cases/${caseId}/documents/${documentId}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setMessage(
        "This document could not be archived. A legal hold or current permission may prevent the change.",
      );
      return;
    }
    router.push(`/cases/${caseId}/documents`);
    router.refresh();
  }
  if (!confirming)
    return (
      <button
        className="button button-secondary"
        onClick={() => setConfirming(true)}
        type="button"
      >
        Archive document
      </button>
    );
  return (
    <div className="archive-confirm">
      <span>
        Hide this document from the active library? Immutable versions and audit
        history are retained.
      </span>
      <button
        className="button button-secondary"
        onClick={() => void archive()}
        type="button"
      >
        Confirm archive
      </button>
      <button
        className="text-action"
        onClick={() => setConfirming(false)}
        type="button"
      >
        Cancel
      </button>
      <span aria-live="polite">{message}</span>
    </div>
  );
}
