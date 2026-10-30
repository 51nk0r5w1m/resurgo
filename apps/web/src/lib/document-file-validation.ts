const acceptedDocumentTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function isAcceptedDocumentFile(file: { name: string; type: string }) {
  const hasAcceptedExtension = /\.(pdf|docx)$/iu.test(file.name);
  return (
    hasAcceptedExtension &&
    (file.type === "" || acceptedDocumentTypes.has(file.type))
  );
}
