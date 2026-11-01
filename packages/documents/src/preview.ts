import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const packageRequire = createRequire(import.meta.url);
const standardFontDataUrl = `${resolve(
  dirname(packageRequire.resolve("pdfjs-dist/package.json")),
  "standard_fonts",
)}/`;

export async function createRasterizedPdfPreview(
  source: Uint8Array,
  input: {
    maximumHeight?: number;
    maximumPages?: number;
    maximumPixelsPerPage?: number;
    maximumWidth?: number;
  } = {},
) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: source.slice(),
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
    isEvalSupported: false,
    standardFontDataUrl,
    stopAtErrors: true,
    useSystemFonts: false,
  } as unknown as Parameters<typeof getDocument>[0]);
  const parsed = await loadingTask.promise;
  const maximumPages = input.maximumPages ?? 100;
  if (parsed.numPages < 1 || parsed.numPages > maximumPages) {
    await loadingTask.destroy();
    throw new Error("PDF page count is outside the preview limit");
  }

  const preview = await PDFDocument.create();
  try {
    for (let pageNumber = 1; pageNumber <= parsed.numPages; pageNumber += 1) {
      const sourcePage = await parsed.getPage(pageNumber);
      const initialViewport = sourcePage.getViewport({ scale: 1 });
      const maximumWidth = input.maximumWidth ?? 1600;
      const maximumHeight = input.maximumHeight ?? 2200;
      const maximumPixelsPerPage = input.maximumPixelsPerPage ?? 3_520_000;
      if (
        !Number.isFinite(initialViewport.width) ||
        !Number.isFinite(initialViewport.height) ||
        initialViewport.width <= 0 ||
        initialViewport.height <= 0
      ) {
        throw new Error("PDF page dimensions are invalid");
      }
      const scale = Math.min(
        2,
        maximumWidth / initialViewport.width,
        maximumHeight / initialViewport.height,
      );
      const viewport = sourcePage.getViewport({ scale });
      const canvasWidth = Math.ceil(viewport.width);
      const canvasHeight = Math.ceil(viewport.height);
      if (
        canvasWidth > maximumWidth ||
        canvasHeight > maximumHeight ||
        canvasWidth * canvasHeight > maximumPixelsPerPage
      ) {
        throw new Error("PDF page exceeds the preview pixel limit");
      }
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await sourcePage.render({
        canvas: canvas as never,
        canvasContext: context as never,
        viewport,
      }).promise;
      const image = await preview.embedPng(await canvas.encode("png"));
      const outputPage = preview.addPage([
        initialViewport.width,
        initialViewport.height,
      ]);
      outputPage.drawImage(image, {
        height: initialViewport.height,
        width: initialViewport.width,
        x: 0,
        y: 0,
      });
      sourcePage.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  preview.setProducer("Resurgo isolated preview renderer");
  preview.setCreator("Resurgo");
  return preview.save({ addDefaultPage: false, useObjectStreams: true });
}
