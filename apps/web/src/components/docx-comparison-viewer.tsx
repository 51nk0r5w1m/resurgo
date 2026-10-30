"use client";

import { useDocxodus } from "docxodus/react";
import { DocumentViewer } from "react-docxodus-viewer";
import { useEffect, useState } from "react";

export function DocxComparisonViewer({
  modifiedSource,
  originalSource,
}: {
  modifiedSource: string;
  originalSource: string;
}) {
  const {
    compare,
    error: runtimeError,
    isReady,
  } = useDocxodus("/docxodus/wasm/");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isReady) return;
    const controller = new AbortController();
    void Promise.all([
      fetch(originalSource, { signal: controller.signal }),
      fetch(modifiedSource, { signal: controller.signal }),
    ])
      .then(async ([original, modified]) => {
        if (!original.ok || !modified.ok) throw new Error();
        return compare(
          new Uint8Array(await original.arrayBuffer()),
          new Uint8Array(await modified.arrayBuffer()),
          { authorName: "Resurgo version comparison" },
        );
      })
      .then((bytes) =>
        setFile(
          new File([new Uint8Array(bytes)], "resurgo-version-comparison.docx", {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        ),
      )
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setError("The Word versions could not be compared.");
      });
    return () => controller.abort();
  }, [compare, isReady, modifiedSource, originalSource]);
  if (error || runtimeError)
    return (
      <div className="viewer-error" role="alert">
        {error || "The Word comparison engine could not start."}
      </div>
    );
  if (!file)
    return (
      <div className="viewer-loading">Building tracked version comparison…</div>
    );
  return (
    <div className="document-viewer-frame docx-frame comparison-frame">
      <DocumentViewer
        defaultSettings={{
          renderTrackedChanges: true,
          showDeletedContent: true,
          stableHeight: "68vh",
        }}
        file={file}
        fitMode="page-width"
        showRevisionsTab
        showSettingsButton
        toolbar="top"
        useWorker={false}
        wasmBasePath="/docxodus/wasm/"
      />
    </div>
  );
}
