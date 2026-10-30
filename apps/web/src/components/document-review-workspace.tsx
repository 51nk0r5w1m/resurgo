"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type Version = {
  byte_size: number;
  created_at: string | Date;
  id: string;
  mime_type: string;
  processing_status: string;
  version_number: number;
};
type Comment = {
  anchor: unknown;
  author_name: string;
  body: string;
  created_at: string | Date;
  document_version_id: string;
  id: string;
  kind: "comment" | "highlight";
  status: string;
};

const DocxViewer = dynamic(
  () =>
    import("./docx-document-viewer").then(
      (module) => module.DocxDocumentViewer,
    ),
  {
    ssr: false,
    loading: () => <div className="viewer-loading">Opening Word document…</div>,
  },
);
const PdfViewer = dynamic(
  () =>
    import("./pdf-document-viewer").then((module) => module.PdfDocumentViewer),
  {
    ssr: false,
    loading: () => (
      <div className="viewer-loading">Opening secure PDF preview…</div>
    ),
  },
);
const DocxComparisonViewer = dynamic(
  () =>
    import("./docx-comparison-viewer").then(
      (module) => module.DocxComparisonViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="viewer-loading">Loading Word comparison engine…</div>
    ),
  },
);

export function DocumentReviewWorkspace({
  caseId,
  comments: initialComments,
  documentId,
  format,
  title,
  versions,
}: {
  caseId: string;
  comments: Comment[];
  documentId: string;
  format: "pdf" | "docx";
  title: string;
  versions: Version[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [comments, setComments] = useState(initialComments);
  const [selectedId, setSelectedId] = useState(
    search.get("version") ?? versions[0]?.id ?? "",
  );
  const [compareId, setCompareId] = useState("");
  const [message, setMessage] = useState("");
  const selected = versions.find(({ id }) => id === selectedId);
  const available = selected?.processing_status === "available";
  const source = `/api/cases/${caseId}/documents/${documentId}/versions/${selectedId}`;
  const previewSource = `${source}?preview=true`;

  async function addComment(
    body: string,
    kind: "comment" | "highlight" = "comment",
    anchor?: unknown,
  ) {
    const response = await fetch(
      `/api/cases/${caseId}/documents/${documentId}/comments`,
      {
        body: JSON.stringify({ anchor, body, kind, versionId: selectedId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    if (!response.ok) throw new Error("Comment could not be saved");
    const payload = (await response.json()) as {
      comment: { id: string; createdAt: string };
    };
    setComments((current) => [
      ...current,
      {
        anchor,
        author_name: "You",
        body,
        created_at: payload.comment.createdAt ?? new Date().toISOString(),
        document_version_id: selectedId,
        id: payload.comment.id,
        kind,
        status: "open",
      },
    ]);
  }

  return (
    <div className="review-workspace">
      <div className="review-toolbar">
        <label>
          Version
          <select
            onChange={(event) => setSelectedId(event.target.value)}
            value={selectedId}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                Version {version.version_number} ·{" "}
                {version.processing_status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {versions.length > 1 && (
          <label>
            Compare with
            <select
              onChange={(event) => setCompareId(event.target.value)}
              value={compareId}
            >
              <option value="">No comparison</option>
              {versions
                .filter(({ id }) => id !== selectedId)
                .map((version) => (
                  <option key={version.id} value={version.id}>
                    Version {version.version_number}
                  </option>
                ))}
            </select>
          </label>
        )}
        {available && (
          <Link className="button button-secondary" href={source}>
            Download version
          </Link>
        )}
      </div>
      {!available ? (
        <div className="processing-gate">
          <strong>This version is not available yet.</strong>
          <p>
            Current status: {selected?.processing_status.replaceAll("_", " ")}.
            Quarantined or rejected files cannot be opened or downloaded.
          </p>
        </div>
      ) : format === "docx" && compareId ? (
        <div className="viewer-single">
          <DocxComparisonViewer
            modifiedSource={previewSource}
            originalSource={`/api/cases/${caseId}/documents/${documentId}/versions/${compareId}?preview=true`}
          />
        </div>
      ) : (
        <div className={compareId ? "viewer-comparison" : "viewer-single"}>
          <Viewer
            format={format}
            onHighlight={(anchor) =>
              addComment("Highlighted for review", "highlight", anchor)
            }
            source={previewSource}
            title={`${title}, version ${selected?.version_number}`}
          />
          {compareId && (
            <Viewer
              format={format}
              source={`/api/cases/${caseId}/documents/${documentId}/versions/${compareId}?preview=true`}
              title={`${title}, comparison version`}
            />
          )}
        </div>
      )}
      <section className="comment-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Evidence-linked review</p>
            <h2>Comments &amp; annotations</h2>
          </div>
          <span>
            {
              comments.filter(
                ({ document_version_id }) => document_version_id === selectedId,
              ).length
            }
          </span>
        </div>
        <CommentForm
          disabled={!available}
          onSave={async (body) => {
            try {
              await addComment(body);
              setMessage("Comment saved to this immutable version.");
              return true;
            } catch {
              setMessage("Comment could not be saved.");
              return false;
            }
          }}
        />
        <div aria-live="polite" className="form-message">
          {message}
        </div>
        <ol className="comment-list">
          {comments
            .filter(
              ({ document_version_id }) => document_version_id === selectedId,
            )
            .map((comment) => (
              <li key={comment.id}>
                <span className={`comment-kind kind-${comment.kind}`}>
                  {comment.kind}
                </span>
                <div>
                  <strong>{comment.author_name}</strong>
                  <p>{comment.body}</p>
                  <small>
                    {new Date(comment.created_at).toLocaleString()} ·{" "}
                    {comment.status}
                  </small>
                </div>
              </li>
            ))}
        </ol>
      </section>
      <ReplacementUpload
        caseId={caseId}
        documentId={documentId}
        format={format}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}

function Viewer({
  format,
  onHighlight,
  source,
  title,
}: {
  format: "pdf" | "docx";
  onHighlight?: (anchor: unknown) => void;
  source: string;
  title: string;
}) {
  return format === "pdf" ? (
    <PdfViewer
      {...(onHighlight ? { onHighlight } : {})}
      source={source}
      title={title}
    />
  ) : (
    <DocxViewer source={source} title={title} />
  );
}

function CommentForm({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (body: string) => Promise<boolean>;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="comment-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          if (await onSave(body)) setBody("");
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        <span className="sr-only">Add a document comment</span>
        <textarea
          disabled={disabled}
          maxLength={4000}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a question, clarification, or review note…"
          required
          value={body}
        />
      </label>
      <button
        className="button button-primary"
        disabled={disabled || pending}
        type="submit"
      >
        {pending ? "Saving…" : "Add comment"}
      </button>
    </form>
  );
}

function ReplacementUpload({
  caseId,
  documentId,
  format,
  onComplete,
}: {
  caseId: string;
  documentId: string;
  format: "pdf" | "docx";
  onComplete: () => void;
}) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch(
      `/api/cases/${caseId}/documents/${documentId}/versions`,
      { body: new FormData(form), method: "POST" },
    );
    setMessage(
      response.ok
        ? "New immutable version uploaded to quarantine."
        : "The replacement could not be uploaded.",
    );
    if (response.ok) {
      form.reset();
      onComplete();
    }
  }
  return (
    <section className="replacement-card">
      <div>
        <p className="eyebrow">Version history</p>
        <h2>Upload a revised version</h2>
        <p>
          The current original remains intact. The revised file must remain{" "}
          {format.toUpperCase()}.
        </p>
      </div>
      <form onSubmit={submit}>
        <input
          accept={
            format === "pdf"
              ? ".pdf,application/pdf"
              : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          }
          aria-label={`Choose revised ${format.toUpperCase()} file`}
          name="file"
          required
          type="file"
        />
        <button className="button button-secondary" type="submit">
          Upload new version
        </button>
        <span aria-live="polite">{message}</span>
      </form>
    </section>
  );
}
