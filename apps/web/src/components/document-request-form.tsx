"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function DocumentRequestForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/cases/${caseId}/document-requests`, {
        body: JSON.stringify({
          classification: values.get("classification"),
          description: values.get("description"),
          title: values.get("title"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        setMessage("The document request could not be created.");
        return;
      }
      form.reset();
      setMessage("Document request added to this private case.");
      router.refresh();
    } catch {
      setMessage("The document request service could not be reached.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="document-upload-form" onSubmit={submit}>
      <label>
        Request title
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
        What is needed?
        <textarea maxLength={4000} name="description" required rows={4} />
      </label>
      <button
        className="button button-secondary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Adding request…" : "Add document request"}
      </button>
      <div aria-live="polite" className="form-message" role="status">
        {message}
      </div>
    </form>
  );
}
