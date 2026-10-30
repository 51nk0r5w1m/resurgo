import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../schema";

type Database = NodePgDatabase<typeof schema>;

const professionalRoles = sql.raw(
  "('attorney', 'lender', 'accountant', 'mediator', 'support_professional')",
);

export interface CaseAccessInput {
  caseId: string;
  evaluatedAt?: Date;
  userId: string;
}

export interface ResourceAccessInput extends CaseAccessInput {
  operation: "view" | "download" | "share";
  resourceId: string;
}

export async function hasEffectiveCaseAccess(
  database: Database,
  input: CaseAccessInput,
): Promise<boolean> {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const result = await database.execute<{ allowed: boolean }>(sql`
    select exists (
      select 1
      from resurgo.case_memberships as case_membership
      left join resurgo.organization_memberships as organization_membership
        on organization_membership.id = case_membership.organization_membership_id
        and organization_membership.user_id = case_membership.user_id
      left join resurgo.organizations as organization
        on organization.id = organization_membership.organization_id
      where case_membership.case_id = ${input.caseId}
        and case_membership.user_id = ${input.userId}
        and case_membership.status = 'active'
        and case_membership.valid_from <= ${evaluatedAt}
        and (case_membership.expires_at is null or case_membership.expires_at > ${evaluatedAt})
        and case_membership.revoked_at is null
        and (
          case_membership.role not in ${professionalRoles}
          or (
            organization_membership.status = 'active'
            and organization_membership.valid_from <= ${evaluatedAt}
            and (
              organization_membership.expires_at is null
              or organization_membership.expires_at > ${evaluatedAt}
            )
            and organization_membership.revoked_at is null
            and organization.pilot_status = 'verified'
          )
        )
    ) as allowed
  `);

  return result.rows[0]?.allowed === true;
}

export async function hasEffectiveResourceAccess(
  database: Database,
  input: ResourceAccessInput,
): Promise<boolean> {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const result = await database.execute<{ allowed: boolean }>(sql`
    select exists (
      select 1
      from resurgo.resource_grants as resource_grant
      inner join resurgo.case_memberships as case_membership
        on case_membership.case_id = resource_grant.case_id
        and case_membership.id = resource_grant.grantee_case_membership_id
      left join resurgo.organization_memberships as organization_membership
        on organization_membership.id = case_membership.organization_membership_id
        and organization_membership.user_id = case_membership.user_id
      left join resurgo.organizations as organization
        on organization.id = organization_membership.organization_id
      left join resurgo.disclosure_consents as consent
        on consent.id = resource_grant.source_consent_id
        and consent.case_id = resource_grant.case_id
        and consent.recipient_case_membership_id = resource_grant.grantee_case_membership_id
        and consent.classification = resource_grant.classification
        and consent.operation = resource_grant.operation
      where resource_grant.case_id = ${input.caseId}
        and resource_grant.resource_id = ${input.resourceId}
        and resource_grant.operation = ${input.operation}
        and resource_grant.status = 'active'
        and resource_grant.effective_at <= ${evaluatedAt}
        and (resource_grant.expires_at is null or resource_grant.expires_at > ${evaluatedAt})
        and resource_grant.revoked_at is null
        and case_membership.user_id = ${input.userId}
        and case_membership.status = 'active'
        and case_membership.valid_from <= ${evaluatedAt}
        and (case_membership.expires_at is null or case_membership.expires_at > ${evaluatedAt})
        and case_membership.revoked_at is null
        and (
          case_membership.role not in ${professionalRoles}
          or (
            organization_membership.status = 'active'
            and organization_membership.valid_from <= ${evaluatedAt}
            and (
              organization_membership.expires_at is null
              or organization_membership.expires_at > ${evaluatedAt}
            )
            and organization_membership.revoked_at is null
            and organization.pilot_status = 'verified'
          )
        )
        and (
          (resource_grant.basis = 'case_owner' and resource_grant.source_consent_id is null)
          or (
            resource_grant.basis = 'explicit_consent'
            and consent.status = 'active'
            and consent.effective_at <= ${evaluatedAt}
            and (consent.expires_at is null or consent.expires_at > ${evaluatedAt})
            and consent.revoked_at is null
          )
        )
    ) as allowed
  `);

  return result.rows[0]?.allowed === true;
}
