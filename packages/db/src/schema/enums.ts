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
