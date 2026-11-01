"use client";

import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfDocumentViewer({
  onHighlight,
  source,
  title,
}: {
  onHighlight?: (anchor: unknown) => void;
  source: string;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [loadedDocument, setLoadedDocument] = useState<{
    pdf: PDFDocumentProxy;
    source: string;
  }>();
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const document =
    loadedDocument?.source === source ? loadedDocument.pdf : undefined;
  const renderKey = `${source}:${page}:${scale}`;
  useEffect(() => {
    let active = true;
    const task = getDocument({ url: source, withCredentials: true });
    task.promise
      .then((pdf) => {
        if (!active) return;
        setLoadedDocument({ pdf, source });
        setPage(1);
      })
      .catch(() => {
        if (!active) return;
        setFailure({
          key: source,
          message: "The authorized PDF preview could not be opened.",
        });
      });
    return () => {
      active = false;
      void task.destroy();
    };
  }, [source]);
  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let active = true;
    const currentRenderKey = `${source}:${page}:${scale}`;
    void document
      .getPage(page)
      .then(async (pdfPage) => {
        if (!active || !canvasRef.current) return;
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas context unavailable");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvas, canvasContext: context, viewport })
          .promise;
      })
      .catch(() => {
        if (active)
          setFailure({
            key: currentRenderKey,
            message: "This PDF page could not be rendered.",
          });
      });
    return () => {
      active = false;
    };
  }, [document, page, scale, source]);
  const error =
    failure?.key === source || failure?.key === renderKey
      ? failure.message
      : "";
  if (error)
    return (
      <div className="viewer-error" role="alert">
        {error}
      </div>
    );
  return (
    <div className="document-viewer-frame pdf-frame" aria-label={title}>
      <div className="pdf-toolbar">
        <button
          disabled={page <= 1}
          onClick={() => setPage((current) => current - 1)}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {page} of {document?.numPages ?? "…"}
        </span>
        <button
          disabled={!document || page >= document.numPages}
          onClick={() => setPage((current) => current + 1)}
          type="button"
        >
          Next
        </button>
        <button
          onClick={() => setScale((current) => Math.max(0.6, current - 0.15))}
          type="button"
        >
          −
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((current) => Math.min(2, current + 0.15))}
          type="button"
        >
          +
        </button>
        {onHighlight && (
          <span className="toolbar-note">Drag on page to highlight</span>
        )}
      </div>
      <div className="pdf-canvas-wrap">
        <canvas
          onPointerDown={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            startRef.current = {
              x: (event.clientX - bounds.left) / bounds.width,
              y: (event.clientY - bounds.top) / bounds.height,
            };
          }}
          onPointerUp={(event) => {
            const start = startRef.current;
            startRef.current = null;
            if (!start || !onHighlight) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const end = {
              x: (event.clientX - bounds.left) / bounds.width,
              y: (event.clientY - bounds.top) / bounds.height,
            };
            onHighlight({
              page,
              rect: {
                height: Math.abs(end.y - start.y),
                width: Math.abs(end.x - start.x),
                x: Math.min(end.x, start.x),
                y: Math.min(end.y, start.y),
              },
            });
          }}
          ref={canvasRef}
        />
      </div>
    </div>
  );
}
