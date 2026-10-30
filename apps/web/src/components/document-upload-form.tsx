"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function DocumentUploadForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/cases/${caseId}/documents`, {
        body: new FormData(form),
        method: "POST",
      });
      if (!response.ok) {
        setMessage(
          response.status === 413
            ? "That file exceeds the 15 MB upload limit."
            : "The document could not be quarantined. Check its type and try again.",
        );
        return;
      }
      form.reset();
      setMessage(
        "Upload received. It remains unavailable while validation and malware scanning run.",
      );
      router.refresh();
    } catch {
      setMessage("The secure upload service could not be reached.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="document-upload-form" onSubmit={submit}>
      <label>
        Document title
        <input maxLength={240} name="title" required />
      </label>
      <label>
        Information domain
        <select name="classification" required>
          <option value="">Choose a domain</option>
          <option value="legal">Legal</option>
          <option value="financial">Financial or mortgage</option>
          <option value="personal_support">Personal support</option>
          <option value="shared">General coordination</option>
        </select>
      </label>
      <label>
        Confidentiality
        <select name="confidentiality" required>
          <option value="standard">Standard case record</option>
          <option value="confidential">Confidential</option>
          <option value="attorney_client">Attorney-client restricted</option>
          <option value="financial_restricted">Financial restricted</option>
          <option value="personal_sensitive">Personal sensitive</option>
        </select>
      </label>
      <label>
        PDF or DOCX file
        <input
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
          name="file"
          required
          type="file"
        />
        <small>
          Maximum 15 MB. Files are quarantined before anyone can open them.
        </small>
      </label>
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Securing upload…" : "Upload securely"}
      </button>
      <div aria-live="polite" className="form-message" role="status">
        {message}
      </div>
    </form>
  );
}
