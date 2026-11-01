"use client";

import { useRouter } from "next/navigation";
import { type DragEvent, type FormEvent, useRef, useState } from "react";

import { isAcceptedDocumentFile } from "../lib/document-file-validation";

const maximumBytes = 15 * 1024 * 1024;
type UploadItem = {
  file: File;
  id: string;
  message?: string;
  progress: number;
  status: "queued" | "uploading" | "complete" | "error";
};

export function DocumentUploadForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  function addFiles(files: FileList | File[]) {
    const next = Array.from(files).map((file) => {
      const invalidType = !isAcceptedDocumentFile(file);
      const error = invalidType
        ? "Choose a PDF or DOCX file."
        : file.size > maximumBytes
          ? "File exceeds the 15 MB limit."
          : undefined;
      return {
        file,
        id: crypto.randomUUID(),
        ...(error ? { message: error } : {}),
        progress: 0,
        status: error ? ("error" as const) : ("queued" as const),
      };
    });
    setItems((existing) => [...existing, ...next]);
    setMessage("");
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function upload(item: UploadItem, form: HTMLFormElement) {
    return new Promise<boolean>((resolve) => {
      const data = new FormData();
      data.set("file", item.file);
      data.set("title", item.file.name.replace(/\.(pdf|docx)$/iu, ""));
      data.set(
        "classification",
        String(new FormData(form).get("classification")),
      );
      data.set(
        "confidentiality",
        String(new FormData(form).get("confidentiality")),
      );
      const request = new XMLHttpRequest();
      request.open("POST", `/api/cases/${caseId}/documents`);
      request.upload.addEventListener("progress", (progress) => {
        if (!progress.lengthComputable) return;
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  progress: Math.round(
                    (progress.loaded / progress.total) * 100,
                  ),
                }
              : candidate,
          ),
        );
      });
      request.addEventListener("load", () => {
        const complete = request.status >= 200 && request.status < 300;
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  message: complete
                    ? "Queued for security processing."
                    : "Upload was rejected.",
                  progress: complete ? 100 : candidate.progress,
                  status: complete ? "complete" : "error",
                }
              : candidate,
          ),
        );
        resolve(complete);
      });
      request.addEventListener("error", () => {
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  message: "Secure upload service could not be reached.",
                  status: "error",
                }
              : candidate,
          ),
        );
        resolve(false);
      });
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: "uploading" }
            : candidate,
        ),
      );
      request.send(data);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    try {
      const queued = items.filter(({ status }) => status === "queued");
      if (queued.length === 0) {
        setMessage("Choose at least one valid PDF or DOCX file.");
        return;
      }
      const results = await Promise.all(
        queued.map((item) => upload(item, form)),
      );
      const uploaded = results.filter(Boolean).length;
      setMessage(
        `${uploaded} of ${queued.length} files uploaded to quarantine.`,
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
      <div className="upload-settings">
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
      </div>
      <div
        className="document-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
      >
        <strong>Drop PDF or DOCX files here</strong>
        <span>or choose files from your device</span>
        <input
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
          aria-label="Choose PDF or DOCX files"
          multiple
          onChange={(event) =>
            event.target.files && addFiles(event.target.files)
          }
          ref={inputRef}
          type="file"
        />
        <button
          className="button button-secondary"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Choose files
        </button>
        <small>
          15 MB per file. Every upload is quarantined and scanned before access.
        </small>
      </div>
      {items.length > 0 && (
        <ul className="upload-queue" aria-label="Files selected for upload">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.file.name}</strong>
                <small>{(item.file.size / 1024 / 1024).toFixed(2)} MB</small>
              </div>
              <progress max="100" value={item.progress}>
                {item.progress}%
              </progress>
              <span className={`upload-${item.status}`}>
                {item.message ?? item.status}
              </span>
              {item.status !== "uploading" && (
                <button
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() =>
                    setItems((current) =>
                      current.filter(({ id }) => id !== item.id),
                    )
                  }
                  type="button"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Securing files…"
          : `Upload ${items.filter(({ status }) => status === "queued").length || ""} securely`}
      </button>
      <div aria-live="polite" className="form-message" role="status">
        {message}
      </div>
    </form>
  );
}
