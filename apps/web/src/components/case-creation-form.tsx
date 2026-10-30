"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function CaseCreationForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const jurisdictionCode = String(
      new FormData(event.currentTarget).get("jurisdictionCode") ?? "",
    );
    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jurisdictionCode }),
    });
    if (!response.ok) {
      setMessage("The private case could not be created.");
      setPending(false);
      return;
    }
    const result = (await response.json()) as { case: { id: string } };
    router.push(`/cases/${result.case.id}/discovery`);
    router.refresh();
  }

  return (
    <form className="case-form" onSubmit={submit}>
      <label>
        Supported Superior Court jurisdiction
        <select name="jurisdictionCode" required>
          <option value="">Choose the court jurisdiction</option>
          <option value="GA-FULTON-SUPERIOR">
            Fulton County Superior Court
          </option>
          <option value="GA-DEKALB-SUPERIOR">
            DeKalb County Superior Court
          </option>
        </select>
      </label>
      <p className="form-note">
        Atlanta spans multiple court jurisdictions. Select the county where the
        divorce will be handled; a Georgia attorney should confirm venue.
      </p>
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating…" : "Create private case"}
      </button>
      <div aria-live="polite" className="form-message">
        {message}
      </div>
    </form>
  );
}
