const opaqueIdentifier = /^[0-9a-f]{8}-[0-9a-f-]{27}$/u;

function assertOpaqueIdentifier(value: string) {
  if (!opaqueIdentifier.test(value)) {
    throw new Error("Invalid opaque document identifier");
  }
  return value;
}

export function documentObjectKeys(input: {
  caseId: string;
  documentId: string;
  versionId: string;
}) {
  const caseId = assertOpaqueIdentifier(input.caseId);
  const documentId = assertOpaqueIdentifier(input.documentId);
  const versionId = assertOpaqueIdentifier(input.versionId);
  const suffix = `${caseId}/${documentId}/${versionId}`;
  return {
    available: `available/${suffix}/source`,
    preview: `previews/${suffix}/preview.pdf`,
    quarantine: `quarantine/${suffix}/source`,
  };
}
