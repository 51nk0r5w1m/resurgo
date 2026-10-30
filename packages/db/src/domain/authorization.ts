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

export type CaseOperation =
  "read" | "manage" | "membership_grant" | "membership_revoke";

export type CaseAuthorizationDecision =
  | {
      allowed: true;
      caseMembershipId: string;
      role: string;
    }
  | {
      allowed: false;
      reasonCode:
        | "case_access_denied"
        | "membership_inactive"
        | "professional_affiliation_inactive"
        | "professional_mfa_required"
        | "role_not_permitted";
    };

export class AuthorizationDeniedError extends Error {
  readonly code = "RESOURCE_UNAVAILABLE";

  constructor() {
    super("Resource not found or unavailable");
    this.name = "AuthorizationDeniedError";
  }
}

export async function decideCaseAuthorization(
  database: Database,
  input: CaseAccessInput & { operation: CaseOperation },
): Promise<CaseAuthorizationDecision> {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const result = await database.execute<{
    case_membership_id: string;
    role: string;
    case_active: boolean;
    membership_active: boolean;
    professional_active: boolean;
    professional_mfa: boolean;
  }>(sql`
    select
      case_membership.id as case_membership_id,
      case_membership.role,
      case_record.status = 'active' as case_active,
      (
        case_membership.status = 'active'
        and case_membership.valid_from <= ${evaluatedAt}
        and (case_membership.expires_at is null or case_membership.expires_at > ${evaluatedAt})
        and case_membership.revoked_at is null
      ) as membership_active,
      (
        case_membership.role not in ${professionalRoles}
        or (
          organization_membership.status = 'active'
          and organization_membership.valid_from <= ${evaluatedAt}
          and (organization_membership.expires_at is null or organization_membership.expires_at > ${evaluatedAt})
          and organization_membership.revoked_at is null
          and organization.pilot_status = 'verified'
        )
      ) as professional_active,
      (
        case_membership.role not in ${professionalRoles}
        or auth_user.two_factor_enabled = true
      ) as professional_mfa
    from resurgo.case_memberships as case_membership
    inner join resurgo.cases as case_record
      on case_record.id = case_membership.case_id
    inner join auth.user as auth_user
      on auth_user.id = case_membership.user_id
    left join resurgo.organization_memberships as organization_membership
      on organization_membership.id = case_membership.organization_membership_id
      and organization_membership.user_id = case_membership.user_id
    left join resurgo.organizations as organization
      on organization.id = organization_membership.organization_id
    where case_membership.case_id = ${input.caseId}
      and case_membership.user_id = ${input.userId}
    order by
      case
        when case_membership.status = 'active'
          and case_membership.valid_from <= ${evaluatedAt}
          and (case_membership.expires_at is null or case_membership.expires_at > ${evaluatedAt})
          and case_membership.revoked_at is null
        then 0 else 1
      end,
      case when case_membership.role = 'owner' then 0 else 1 end,
      case_membership.created_at,
      case_membership.id
  `);
  // The schema prevents duplicate user/case memberships. Still evaluate every
  // candidate so an eligible membership wins if historical data predates that
  // constraint or the lifecycle model later permits retained history rows.
  const row =
    result.rows.find(
      (candidate) =>
        candidate.case_active &&
        candidate.membership_active &&
        candidate.professional_active &&
        candidate.professional_mfa &&
        (input.operation === "read" || candidate.role === "owner"),
    ) ?? result.rows[0];
  if (!row || !row.case_active) {
    return { allowed: false, reasonCode: "case_access_denied" };
  }
  if (!row.membership_active) {
    return { allowed: false, reasonCode: "membership_inactive" };
  }
  if (!row.professional_active) {
    return {
      allowed: false,
      reasonCode: "professional_affiliation_inactive",
    };
  }
  if (!row.professional_mfa) {
    return { allowed: false, reasonCode: "professional_mfa_required" };
  }
  if (input.operation !== "read" && row.role !== "owner") {
    return { allowed: false, reasonCode: "role_not_permitted" };
  }
  return {
    allowed: true,
    caseMembershipId: row.case_membership_id,
    role: row.role,
  };
}

export async function requireCaseAuthorization(
  database: Database,
  input: CaseAccessInput & { operation: CaseOperation },
) {
  const decision = await decideCaseAuthorization(database, input);
  if (!decision.allowed) throw new AuthorizationDeniedError();
  return decision;
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
      inner join resurgo.cases as case_record
        on case_record.id = case_membership.case_id
      inner join auth.user as auth_user
        on auth_user.id = case_membership.user_id
      left join resurgo.organization_memberships as organization_membership
        on organization_membership.id = case_membership.organization_membership_id
        and organization_membership.user_id = case_membership.user_id
      left join resurgo.organizations as organization
        on organization.id = organization_membership.organization_id
      where case_membership.case_id = ${input.caseId}
        and case_membership.user_id = ${input.userId}
        and case_record.status = 'active'
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
            and auth_user.two_factor_enabled = true
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
      inner join resurgo.cases as case_record
        on case_record.id = resource_grant.case_id
      inner join resurgo.case_memberships as case_membership
        on case_membership.case_id = resource_grant.case_id
        and case_membership.id = resource_grant.grantee_case_membership_id
      inner join auth.user as auth_user
        on auth_user.id = case_membership.user_id
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
        and case_record.status = 'active'
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
            and auth_user.two_factor_enabled = true
          )
        )
        and (
          (
            resource_grant.basis = 'case_owner'
            and resource_grant.source_consent_id is null
            and case_membership.role = 'owner'
            and case_record.owner_user_id = case_membership.user_id
          )
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
