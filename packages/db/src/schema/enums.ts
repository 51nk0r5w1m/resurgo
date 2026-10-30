import { resurgoSchema } from "./system";

export const organizationType = resurgoSchema.enum("organization_type", [
  "law_firm",
  "lender",
  "accounting_firm",
  "mediation_practice",
  "support_provider",
  "other_professional",
]);

export const pilotVerificationStatus = resurgoSchema.enum(
  "pilot_verification_status",
  ["candidate", "verified", "suspended", "ended"],
);

export const membershipStatus = resurgoSchema.enum("membership_status", [
  "invited",
  "active",
  "suspended",
  "revoked",
  "expired",
]);

export const organizationRole = resurgoSchema.enum("organization_role", [
  "owner",
  "admin",
  "professional",
  "staff",
]);

export const caseStatus = resurgoSchema.enum("case_status", [
  "active",
  "paused",
  "closed",
]);

export const caseRole = resurgoSchema.enum("case_role", [
  "owner",
  "co_client",
  "attorney",
  "lender",
  "accountant",
  "mediator",
  "support_professional",
  "coordinator",
]);

export const resourceType = resurgoSchema.enum("resource_type", [
  "document",
  "professional_review",
  "intake_response",
  "roadmap_item",
  "coordination_note",
]);

export const resourceClassification = resurgoSchema.enum(
  "resource_classification",
  ["shared", "legal", "financial", "personal_support", "health"],
);

export const resourceOperation = resurgoSchema.enum("resource_operation", [
  "view",
  "download",
  "share",
  "contribute",
]);

export const consentStatus = resurgoSchema.enum("consent_status", [
  "active",
  "revoked",
  "expired",
]);

export const grantBasis = resurgoSchema.enum("grant_basis", [
  "case_owner",
  "explicit_consent",
]);

export const grantStatus = resurgoSchema.enum("grant_status", [
  "active",
  "revoked",
  "expired",
]);

export const auditActorType = resurgoSchema.enum("audit_actor_type", [
  "user",
  "system",
]);

export const auditOutcome = resurgoSchema.enum("audit_outcome", [
  "success",
  "denied",
  "failure",
]);

export const discoveryStatus = resurgoSchema.enum("discovery_status", [
  "in_progress",
  "completed",
]);

export const recommendationService = resurgoSchema.enum(
  "recommendation_service",
  [
    "divorce_attorney",
    "mortgage_specialist",
    "financial_specialist",
    "personal_support",
  ],
);

export const roadmapStatus = resurgoSchema.enum("roadmap_status", [
  "upcoming",
  "ready",
  "completed",
]);

export const documentFormat = resurgoSchema.enum("document_format", [
  "pdf",
  "docx",
]);

export const documentConfidentiality = resurgoSchema.enum(
  "document_confidentiality",
  [
    "standard",
    "confidential",
    "attorney_client",
    "financial_restricted",
    "personal_sensitive",
  ],
);

export const documentSource = resurgoSchema.enum("document_source", [
  "client_upload",
  "professional_upload",
  "generated",
  "imported",
]);

export const documentContributorRole = resurgoSchema.enum(
  "document_contributor_role",
  ["owner", "uploader", "version_author"],
);

export const documentContributorStatus = resurgoSchema.enum(
  "document_contributor_status",
  ["active", "revoked"],
);

export const documentProcessingStatus = resurgoSchema.enum(
  "document_processing_status",
  ["quarantined", "processing", "available", "rejected", "superseded"],
);

export const legalHoldAction = resurgoSchema.enum("legal_hold_action", [
  "placed",
  "released",
]);

export const professionalReviewSubject = resurgoSchema.enum(
  "professional_review_subject",
  [
    "document_set",
    "mortgage_property",
    "financial_position",
    "legal_strategy",
    "case_coordination",
    "other",
  ],
);

export const professionalReviewStatus = resurgoSchema.enum(
  "professional_review_status",
  [
    "assigned",
    "in_progress",
    "clarification_required",
    "completed",
    "withdrawn",
    "superseded",
  ],
);

export const reviewStatementType = resurgoSchema.enum("review_statement_type", [
  "finding",
  "outstanding_condition",
  "clarification_request",
]);

export const reviewConditionStatus = resurgoSchema.enum(
  "review_condition_status",
  ["open", "satisfied", "waived", "not_applicable"],
);

export const reviewAcknowledgementAction = resurgoSchema.enum(
  "review_acknowledgement_action",
  ["acknowledged", "withdrawn"],
);
