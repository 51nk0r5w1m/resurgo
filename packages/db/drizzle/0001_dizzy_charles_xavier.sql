CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TYPE "resurgo"."audit_actor_type" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "resurgo"."audit_outcome" AS ENUM('success', 'denied', 'failure');--> statement-breakpoint
CREATE TYPE "resurgo"."case_role" AS ENUM('owner', 'co_client', 'attorney', 'lender', 'accountant', 'mediator', 'support_professional', 'coordinator');--> statement-breakpoint
CREATE TYPE "resurgo"."case_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "resurgo"."consent_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "resurgo"."grant_basis" AS ENUM('case_owner', 'explicit_consent');--> statement-breakpoint
CREATE TYPE "resurgo"."grant_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "resurgo"."membership_status" AS ENUM('invited', 'active', 'suspended', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "resurgo"."organization_role" AS ENUM('owner', 'admin', 'professional', 'staff');--> statement-breakpoint
CREATE TYPE "resurgo"."organization_type" AS ENUM('law_firm', 'lender', 'accounting_firm', 'mediation_practice', 'support_provider', 'other_professional');--> statement-breakpoint
CREATE TYPE "resurgo"."resource_classification" AS ENUM('shared', 'legal', 'financial', 'personal_support', 'health');--> statement-breakpoint
CREATE TYPE "resurgo"."resource_operation" AS ENUM('view', 'download', 'share');--> statement-breakpoint
CREATE TYPE "resurgo"."resource_type" AS ENUM('document', 'intake_response', 'roadmap_item', 'coordination_note');--> statement-breakpoint
CREATE TABLE "resurgo"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "resurgo"."audit_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_type" "resurgo"."audit_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"case_id" uuid,
	"outcome" "resurgo"."audit_outcome" NOT NULL,
	"reason_code" text,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_event_hash" char(64),
	"event_hash" char(64) NOT NULL,
	CONSTRAINT "audit_events_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "audit_events_event_hash_unique" UNIQUE("event_hash"),
	CONSTRAINT "audit_events_actor_check" CHECK (("resurgo"."audit_events"."actor_type" = 'user' and "resurgo"."audit_events"."actor_user_id" is not null) or ("resurgo"."audit_events"."actor_type" = 'system' and "resurgo"."audit_events"."actor_user_id" is null)),
	CONSTRAINT "audit_events_hash_check" CHECK ("resurgo"."audit_events"."event_hash" ~ '^[0-9a-f]{64}$' and ("resurgo"."audit_events"."previous_event_hash" is null or "resurgo"."audit_events"."previous_event_hash" ~ '^[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resurgo"."case_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_membership_id" uuid,
	"role" "resurgo"."case_role" NOT NULL,
	"status" "resurgo"."membership_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid,
	"valid_from" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_memberships_case_user_unique" UNIQUE("case_id","user_id"),
	CONSTRAINT "case_memberships_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "case_memberships_professional_affiliation_check" CHECK (("resurgo"."case_memberships"."role" in ('attorney', 'lender', 'accountant', 'mediator', 'support_professional') and "resurgo"."case_memberships"."organization_membership_id" is not null) or ("resurgo"."case_memberships"."role" not in ('attorney', 'lender', 'accountant', 'mediator', 'support_professional') and "resurgo"."case_memberships"."organization_membership_id" is null)),
	CONSTRAINT "case_memberships_valid_interval_check" CHECK ("resurgo"."case_memberships"."expires_at" is null or "resurgo"."case_memberships"."valid_from" is null or "resurgo"."case_memberships"."expires_at" > "resurgo"."case_memberships"."valid_from"),
	CONSTRAINT "case_memberships_lifecycle_check" CHECK (("resurgo"."case_memberships"."status" not in ('active', 'suspended') or "resurgo"."case_memberships"."valid_from" is not null) and ("resurgo"."case_memberships"."status" <> 'expired' or "resurgo"."case_memberships"."expires_at" is not null)),
	CONSTRAINT "case_memberships_revoked_state_check" CHECK (("resurgo"."case_memberships"."status" = 'revoked' and "resurgo"."case_memberships"."revoked_at" is not null) or ("resurgo"."case_memberships"."status" <> 'revoked' and "resurgo"."case_memberships"."revoked_at" is null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"status" "resurgo"."case_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cases_id_owner_unique" UNIQUE("id","owner_user_id"),
	CONSTRAINT "cases_jurisdiction_code_format_check" CHECK ("resurgo"."cases"."jurisdiction_code" ~ '^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$')
);
--> statement-breakpoint
CREATE TABLE "resurgo"."organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "resurgo"."organization_role" NOT NULL,
	"status" "resurgo"."membership_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid,
	"valid_from" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "organization_memberships_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "organization_memberships_valid_interval_check" CHECK ("resurgo"."organization_memberships"."expires_at" is null or "resurgo"."organization_memberships"."valid_from" is null or "resurgo"."organization_memberships"."expires_at" > "resurgo"."organization_memberships"."valid_from"),
	CONSTRAINT "organization_memberships_lifecycle_check" CHECK (("resurgo"."organization_memberships"."status" not in ('active', 'suspended') or "resurgo"."organization_memberships"."valid_from" is not null) and ("resurgo"."organization_memberships"."status" <> 'expired' or "resurgo"."organization_memberships"."expires_at" is not null)),
	CONSTRAINT "organization_memberships_revoked_state_check" CHECK (("resurgo"."organization_memberships"."status" = 'revoked' and "resurgo"."organization_memberships"."revoked_at" is not null) or ("resurgo"."organization_memberships"."status" <> 'revoked' and "resurgo"."organization_memberships"."revoked_at" is null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "resurgo"."organization_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_slug_format_check" CHECK ("resurgo"."organizations"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "resurgo"."case_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"owner_case_membership_id" uuid NOT NULL,
	"type" "resurgo"."resource_type" NOT NULL,
	"classification" "resurgo"."resource_classification" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_resources_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "case_resources_case_id_id_classification_unique" UNIQUE("case_id","id","classification")
);
--> statement-breakpoint
CREATE TABLE "resurgo"."disclosure_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"grantor_case_membership_id" uuid NOT NULL,
	"recipient_case_membership_id" uuid NOT NULL,
	"classification" "resurgo"."resource_classification" NOT NULL,
	"operation" "resurgo"."resource_operation" NOT NULL,
	"purpose" text NOT NULL,
	"terms_hash" char(64) NOT NULL,
	"status" "resurgo"."consent_status" DEFAULT 'active' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disclosure_consents_grant_scope_unique" UNIQUE("case_id","id","recipient_case_membership_id","classification","operation"),
	CONSTRAINT "disclosure_consents_distinct_parties_check" CHECK ("resurgo"."disclosure_consents"."grantor_case_membership_id" <> "resurgo"."disclosure_consents"."recipient_case_membership_id"),
	CONSTRAINT "disclosure_consents_terms_hash_check" CHECK ("resurgo"."disclosure_consents"."terms_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "disclosure_consents_valid_interval_check" CHECK ("resurgo"."disclosure_consents"."expires_at" is null or "resurgo"."disclosure_consents"."expires_at" > "resurgo"."disclosure_consents"."effective_at"),
	CONSTRAINT "disclosure_consents_revoked_state_check" CHECK (("resurgo"."disclosure_consents"."status" = 'revoked' and "resurgo"."disclosure_consents"."revoked_at" is not null) or ("resurgo"."disclosure_consents"."status" <> 'revoked' and "resurgo"."disclosure_consents"."revoked_at" is null)),
	CONSTRAINT "disclosure_consents_expired_state_check" CHECK ("resurgo"."disclosure_consents"."status" <> 'expired' or "resurgo"."disclosure_consents"."expires_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "resurgo"."resource_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"grantee_case_membership_id" uuid NOT NULL,
	"classification" "resurgo"."resource_classification" NOT NULL,
	"operation" "resurgo"."resource_operation" NOT NULL,
	"basis" "resurgo"."grant_basis" NOT NULL,
	"source_consent_id" uuid,
	"status" "resurgo"."grant_status" DEFAULT 'active' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_grants_scope_unique" UNIQUE("resource_id","grantee_case_membership_id","operation","basis"),
	CONSTRAINT "resource_grants_basis_consent_check" CHECK (("resurgo"."resource_grants"."basis" = 'explicit_consent' and "resurgo"."resource_grants"."source_consent_id" is not null) or ("resurgo"."resource_grants"."basis" = 'case_owner' and "resurgo"."resource_grants"."source_consent_id" is null)),
	CONSTRAINT "resource_grants_valid_interval_check" CHECK ("resurgo"."resource_grants"."expires_at" is null or "resurgo"."resource_grants"."expires_at" > "resurgo"."resource_grants"."effective_at"),
	CONSTRAINT "resource_grants_revoked_state_check" CHECK (("resurgo"."resource_grants"."status" = 'revoked' and "resurgo"."resource_grants"."revoked_at" is not null) or ("resurgo"."resource_grants"."status" <> 'revoked' and "resurgo"."resource_grants"."revoked_at" is null)),
	CONSTRAINT "resource_grants_expired_state_check" CHECK ("resurgo"."resource_grants"."status" <> 'expired' or "resurgo"."resource_grants"."expires_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "resurgo"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."audit_events" ADD CONSTRAINT "audit_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_memberships" ADD CONSTRAINT "case_memberships_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_memberships" ADD CONSTRAINT "case_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_memberships" ADD CONSTRAINT "case_memberships_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_memberships" ADD CONSTRAINT "case_memberships_organization_membership_user_fk" FOREIGN KEY ("organization_membership_id","user_id") REFERENCES "resurgo"."organization_memberships"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."cases" ADD CONSTRAINT "cases_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."cases" ADD CONSTRAINT "cases_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "resurgo"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_resources" ADD CONSTRAINT "case_resources_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_resources" ADD CONSTRAINT "case_resources_owner_membership_fk" FOREIGN KEY ("case_id","owner_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."disclosure_consents" ADD CONSTRAINT "disclosure_consents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."disclosure_consents" ADD CONSTRAINT "disclosure_consents_grantor_membership_fk" FOREIGN KEY ("case_id","grantor_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."disclosure_consents" ADD CONSTRAINT "disclosure_consents_recipient_membership_fk" FOREIGN KEY ("case_id","recipient_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."resource_grants" ADD CONSTRAINT "resource_grants_grantee_membership_fk" FOREIGN KEY ("case_id","grantee_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."resource_grants" ADD CONSTRAINT "resource_grants_resource_classification_fk" FOREIGN KEY ("case_id","resource_id","classification") REFERENCES "resurgo"."case_resources"("case_id","id","classification") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."resource_grants" ADD CONSTRAINT "resource_grants_source_consent_scope_fk" FOREIGN KEY ("case_id","source_consent_id","grantee_case_membership_id","classification","operation") REFERENCES "resurgo"."disclosure_consents"("case_id","id","recipient_case_membership_id","classification","operation") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_case_occurred_at_idx" ON "resurgo"."audit_events" USING btree ("case_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_occurred_at_idx" ON "resurgo"."audit_events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_correlation_id_idx" ON "resurgo"."audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_account_provider_account_unique" ON "auth"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_expires_at_idx" ON "auth"."session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "auth_verification_expires_at_idx" ON "auth"."verification" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_memberships_one_owner_idx" ON "resurgo"."case_memberships" USING btree ("case_id") WHERE "resurgo"."case_memberships"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "case_memberships_user_status_idx" ON "resurgo"."case_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "case_memberships_case_status_idx" ON "resurgo"."case_memberships" USING btree ("case_id","status");--> statement-breakpoint
CREATE INDEX "cases_owner_user_idx" ON "resurgo"."cases" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "resurgo"."organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_organization_status_idx" ON "resurgo"."organization_memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "case_resources_case_classification_idx" ON "resurgo"."case_resources" USING btree ("case_id","classification");--> statement-breakpoint
CREATE INDEX "disclosure_consents_case_recipient_status_idx" ON "resurgo"."disclosure_consents" USING btree ("case_id","recipient_case_membership_id","status");--> statement-breakpoint
CREATE INDEX "resource_grants_grantee_status_idx" ON "resurgo"."resource_grants" USING btree ("grantee_case_membership_id","status");
--> statement-breakpoint
CREATE FUNCTION "resurgo"."enforce_case_owner_membership"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM "resurgo"."case_memberships" AS membership
		WHERE membership."case_id" = NEW."id"
			AND membership."user_id" = NEW."owner_user_id"
			AND membership."role" = 'owner'
			AND membership."status" = 'active'
	) THEN
		RAISE EXCEPTION 'case owner must have one active owner membership'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "cases_active_owner_membership_check"
AFTER INSERT OR UPDATE OF "owner_user_id" ON "resurgo"."cases"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "resurgo"."enforce_case_owner_membership"();
--> statement-breakpoint
CREATE FUNCTION "resurgo"."protect_case_owner_membership"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	current_owner uuid;
BEGIN
	SELECT "owner_user_id" INTO current_owner
	FROM "resurgo"."cases"
	WHERE "id" = OLD."case_id";

	IF current_owner = OLD."user_id" AND NOT EXISTS (
		SELECT 1
		FROM "resurgo"."case_memberships" AS membership
		WHERE membership."case_id" = OLD."case_id"
			AND membership."user_id" = current_owner
			AND membership."role" = 'owner'
			AND membership."status" = 'active'
	) THEN
		RAISE EXCEPTION 'case owner membership cannot be removed or deactivated before ownership transfer'
			USING ERRCODE = '23514';
	END IF;
	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "case_memberships_preserve_active_owner_check"
AFTER UPDATE OR DELETE ON "resurgo"."case_memberships"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "resurgo"."protect_case_owner_membership"();
--> statement-breakpoint
CREATE FUNCTION "resurgo"."reject_audit_event_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'audit events are append-only'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "resurgo"."audit_events"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_audit_event_mutation"();
