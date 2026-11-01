"use client";

import { DocumentViewer } from "react-docxodus-viewer";
import { useEffect, useState } from "react";

export function DocxDocumentViewer({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(source, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        setFile(
          new File([blob], `${title}.docx`, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        );
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setError("The authorized Word preview could not be opened.");
      });
    return () => controller.abort();
  }, [source, title]);
  if (error)
    return (
      <div className="viewer-error" role="alert">
        {error}
      </div>
    );
  return (
    <div className="document-viewer-frame docx-frame" aria-label={title}>
      {file ? (
        <DocumentViewer
          defaultSettings={{
            commentMode: "margin",
            renderTrackedChanges: true,
            showDeletedContent: true,
            stableHeight: "68vh",
          }}
          file={file}
          fitMode="page-width"
          onError={() =>
            setError("This Word document could not be safely rendered.")
          }
          showRevisionsTab
          showSettingsButton
          toolbar="top"
          useWorker={false}
          wasmBasePath="/docxodus/wasm/"
        />
      ) : (
        <div className="viewer-loading">Loading authorized document…</div>
      )}
    </div>
  );
}
