CREATE TYPE "resurgo"."document_confidentiality" AS ENUM('standard', 'confidential', 'attorney_client', 'financial_restricted', 'personal_sensitive');--> statement-breakpoint
CREATE TYPE "resurgo"."document_contributor_role" AS ENUM('owner', 'uploader', 'version_author');--> statement-breakpoint
CREATE TYPE "resurgo"."document_contributor_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "resurgo"."document_format" AS ENUM('pdf', 'docx');--> statement-breakpoint
CREATE TYPE "resurgo"."document_processing_status" AS ENUM('quarantined', 'processing', 'available', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "resurgo"."document_source" AS ENUM('client_upload', 'professional_upload', 'generated', 'imported');--> statement-breakpoint
CREATE TYPE "resurgo"."legal_hold_action" AS ENUM('placed', 'released');--> statement-breakpoint
CREATE TYPE "resurgo"."professional_review_status" AS ENUM('assigned', 'in_progress', 'clarification_required', 'completed', 'withdrawn', 'superseded');--> statement-breakpoint
CREATE TYPE "resurgo"."professional_review_subject" AS ENUM('document_set', 'mortgage_property', 'financial_position', 'legal_strategy', 'case_coordination', 'other');--> statement-breakpoint
CREATE TYPE "resurgo"."review_acknowledgement_action" AS ENUM('acknowledged', 'withdrawn');--> statement-breakpoint
CREATE TYPE "resurgo"."review_condition_status" AS ENUM('open', 'satisfied', 'waived', 'not_applicable');--> statement-breakpoint
CREATE TYPE "resurgo"."review_statement_type" AS ENUM('finding', 'outstanding_condition', 'clarification_request');--> statement-breakpoint
ALTER TYPE "resurgo"."resource_operation" ADD VALUE 'contribute';--> statement-breakpoint
ALTER TYPE "resurgo"."resource_type" ADD VALUE 'professional_review' BEFORE 'intake_response';--> statement-breakpoint
CREATE TABLE "resurgo"."document_contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"case_membership_id" uuid NOT NULL,
	"role" "resurgo"."document_contributor_role" NOT NULL,
	"status" "resurgo"."document_contributor_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "document_contributors_revoked_check" CHECK (("resurgo"."document_contributors"."status" = 'revoked' and "resurgo"."document_contributors"."revoked_at" is not null) or ("resurgo"."document_contributors"."status" = 'active' and "resurgo"."document_contributors"."revoked_at" is null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."document_legal_hold_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"action" "resurgo"."legal_hold_action" NOT NULL,
	"reason_code" text NOT NULL,
	"actor_case_membership_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_legal_hold_reason_check" CHECK ("resurgo"."document_legal_hold_events"."reason_code" ~ '^[a-z][a-z0-9_]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "resurgo"."document_processing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"status" "resurgo"."document_processing_status" NOT NULL,
	"failure_code" text,
	"actor_case_membership_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_processing_events_failure_check" CHECK (("resurgo"."document_processing_events"."status" = 'rejected' and "resurgo"."document_processing_events"."failure_code" is not null) or ("resurgo"."document_processing_events"."status" <> 'rejected' and "resurgo"."document_processing_events"."failure_code" is null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" char(64) NOT NULL,
	"byte_size" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"source" "resurgo"."document_source" NOT NULL,
	"source_reference" text,
	"created_by_case_membership_id" uuid NOT NULL,
	"supersedes_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_case_document_version_unique" UNIQUE("case_id","document_id","version_number"),
	CONSTRAINT "document_versions_case_document_id_unique" UNIQUE("case_id","document_id","id"),
	CONSTRAINT "document_versions_number_check" CHECK ("resurgo"."document_versions"."version_number" > 0),
	CONSTRAINT "document_versions_size_check" CHECK ("resurgo"."document_versions"."byte_size" > 0),
	CONSTRAINT "document_versions_hash_check" CHECK ("resurgo"."document_versions"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "document_versions_mime_check" CHECK ("resurgo"."document_versions"."mime_type" in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
	CONSTRAINT "document_versions_lineage_check" CHECK (("resurgo"."document_versions"."version_number" = 1 and "resurgo"."document_versions"."supersedes_version_id" is null) or ("resurgo"."document_versions"."version_number" > 1 and "resurgo"."document_versions"."supersedes_version_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_resource_id" uuid NOT NULL,
	"owner_case_membership_id" uuid NOT NULL,
	"title" text NOT NULL,
	"format" "resurgo"."document_format" NOT NULL,
	"confidentiality" "resurgo"."document_confidentiality" NOT NULL,
	"retention_class" text NOT NULL,
	"retain_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "documents_case_resource_unique" UNIQUE("case_id","case_resource_id"),
	CONSTRAINT "documents_title_check" CHECK (length(trim("resurgo"."documents"."title")) between 1 and 240),
	CONSTRAINT "documents_retention_class_check" CHECK ("resurgo"."documents"."retention_class" ~ '^[a-z][a-z0-9_]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "resurgo"."professional_review_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"professional_review_id" uuid NOT NULL,
	"review_revision_id" uuid NOT NULL,
	"attorney_case_membership_id" uuid NOT NULL,
	"action" "resurgo"."review_acknowledgement_action" NOT NULL,
	"statement_hash" char(64) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_review_acknowledgements_hash_check" CHECK ("resurgo"."professional_review_acknowledgements"."statement_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "resurgo"."professional_review_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"professional_review_id" uuid NOT NULL,
	"review_revision_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_review_evidence_revision_version_unique" UNIQUE("review_revision_id","document_version_id"),
	CONSTRAINT "professional_review_evidence_purpose_check" CHECK (length(trim("resurgo"."professional_review_evidence"."purpose")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "resurgo"."professional_review_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"professional_review_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" "resurgo"."professional_review_status" NOT NULL,
	"decision_context" text NOT NULL,
	"review_scope" text NOT NULL,
	"created_by_case_membership_id" uuid NOT NULL,
	"supersedes_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_review_revisions_case_review_revision_unique" UNIQUE("case_id","professional_review_id","revision"),
	CONSTRAINT "professional_review_revisions_case_review_id_unique" UNIQUE("case_id","professional_review_id","id"),
	CONSTRAINT "professional_review_revisions_number_check" CHECK ("resurgo"."professional_review_revisions"."revision" > 0),
	CONSTRAINT "professional_review_revisions_lineage_check" CHECK (("resurgo"."professional_review_revisions"."revision" = 1 and "resurgo"."professional_review_revisions"."supersedes_revision_id" is null) or ("resurgo"."professional_review_revisions"."revision" > 1 and "resurgo"."professional_review_revisions"."supersedes_revision_id" is not null)),
	CONSTRAINT "professional_review_revisions_context_check" CHECK (length(trim("resurgo"."professional_review_revisions"."decision_context")) between 1 and 2000),
	CONSTRAINT "professional_review_revisions_scope_check" CHECK (length(trim("resurgo"."professional_review_revisions"."review_scope")) between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "resurgo"."professional_review_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"professional_review_id" uuid NOT NULL,
	"review_revision_id" uuid NOT NULL,
	"type" "resurgo"."review_statement_type" NOT NULL,
	"body" text NOT NULL,
	"condition_status" "resurgo"."review_condition_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_review_statements_condition_check" CHECK (("resurgo"."professional_review_statements"."type" = 'outstanding_condition' and "resurgo"."professional_review_statements"."condition_status" is not null) or ("resurgo"."professional_review_statements"."type" <> 'outstanding_condition' and "resurgo"."professional_review_statements"."condition_status" is null)),
	CONSTRAINT "professional_review_statements_body_check" CHECK (length(trim("resurgo"."professional_review_statements"."body")) between 1 and 8000)
);
--> statement-breakpoint
CREATE TABLE "resurgo"."professional_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_resource_id" uuid NOT NULL,
	"subject_type" "resurgo"."professional_review_subject" NOT NULL,
	"subject_resource_id" uuid,
	"responsible_case_membership_id" uuid NOT NULL,
	"created_by_case_membership_id" uuid NOT NULL,
	"supersedes_review_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_reviews_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "professional_reviews_case_resource_unique" UNIQUE("case_id","case_resource_id")
);
--> statement-breakpoint
ALTER TABLE "resurgo"."audit_events" ADD COLUMN "nonce" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."document_contributors" ADD CONSTRAINT "document_contributors_document_fk" FOREIGN KEY ("case_id","document_id") REFERENCES "resurgo"."documents"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_contributors" ADD CONSTRAINT "document_contributors_membership_fk" FOREIGN KEY ("case_id","case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_legal_hold_events" ADD CONSTRAINT "document_legal_hold_document_fk" FOREIGN KEY ("case_id","document_id") REFERENCES "resurgo"."documents"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_legal_hold_events" ADD CONSTRAINT "document_legal_hold_actor_membership_fk" FOREIGN KEY ("case_id","actor_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_processing_events" ADD CONSTRAINT "document_processing_events_version_fk" FOREIGN KEY ("case_id","document_id","document_version_id") REFERENCES "resurgo"."document_versions"("case_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_processing_events" ADD CONSTRAINT "document_processing_events_actor_fk" FOREIGN KEY ("case_id","actor_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_versions" ADD CONSTRAINT "document_versions_document_fk" FOREIGN KEY ("case_id","document_id") REFERENCES "resurgo"."documents"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_versions" ADD CONSTRAINT "document_versions_creator_membership_fk" FOREIGN KEY ("case_id","created_by_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_versions" ADD CONSTRAINT "document_versions_supersedes_same_document_fk" FOREIGN KEY ("case_id","document_id","supersedes_version_id") REFERENCES "resurgo"."document_versions"("case_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD CONSTRAINT "documents_case_resource_fk" FOREIGN KEY ("case_id","case_resource_id") REFERENCES "resurgo"."case_resources"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD CONSTRAINT "documents_owner_membership_fk" FOREIGN KEY ("case_id","owner_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_acknowledgements" ADD CONSTRAINT "professional_review_acknowledgements_revision_fk" FOREIGN KEY ("case_id","professional_review_id","review_revision_id") REFERENCES "resurgo"."professional_review_revisions"("case_id","professional_review_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_acknowledgements" ADD CONSTRAINT "professional_review_acknowledgements_attorney_fk" FOREIGN KEY ("case_id","attorney_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_evidence" ADD CONSTRAINT "professional_review_evidence_revision_fk" FOREIGN KEY ("case_id","professional_review_id","review_revision_id") REFERENCES "resurgo"."professional_review_revisions"("case_id","professional_review_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_evidence" ADD CONSTRAINT "professional_review_evidence_document_version_fk" FOREIGN KEY ("case_id","document_id","document_version_id") REFERENCES "resurgo"."document_versions"("case_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_revisions" ADD CONSTRAINT "professional_review_revisions_review_fk" FOREIGN KEY ("case_id","professional_review_id") REFERENCES "resurgo"."professional_reviews"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_revisions" ADD CONSTRAINT "professional_review_revisions_creator_membership_fk" FOREIGN KEY ("case_id","created_by_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_revisions" ADD CONSTRAINT "professional_review_revisions_supersedes_same_review_fk" FOREIGN KEY ("case_id","professional_review_id","supersedes_revision_id") REFERENCES "resurgo"."professional_review_revisions"("case_id","professional_review_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_statements" ADD CONSTRAINT "professional_review_statements_revision_fk" FOREIGN KEY ("case_id","professional_review_id","review_revision_id") REFERENCES "resurgo"."professional_review_revisions"("case_id","professional_review_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_case_resource_fk" FOREIGN KEY ("case_id","case_resource_id") REFERENCES "resurgo"."case_resources"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_subject_resource_fk" FOREIGN KEY ("case_id","subject_resource_id") REFERENCES "resurgo"."case_resources"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_responsible_membership_fk" FOREIGN KEY ("case_id","responsible_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_creator_membership_fk" FOREIGN KEY ("case_id","created_by_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_supersedes_same_case_fk" FOREIGN KEY ("case_id","supersedes_review_id") REFERENCES "resurgo"."professional_reviews"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_contributors_active_scope_unique" ON "resurgo"."document_contributors" USING btree ("document_id","case_membership_id","role") WHERE "resurgo"."document_contributors"."status" = 'active';--> statement-breakpoint
CREATE INDEX "document_contributors_membership_status_idx" ON "resurgo"."document_contributors" USING btree ("case_membership_id","status");--> statement-breakpoint
CREATE INDEX "document_legal_hold_document_time_idx" ON "resurgo"."document_legal_hold_events" USING btree ("document_id","occurred_at");--> statement-breakpoint
CREATE INDEX "document_processing_events_version_time_idx" ON "resurgo"."document_processing_events" USING btree ("document_version_id","occurred_at");--> statement-breakpoint
CREATE INDEX "document_versions_document_created_at_idx" ON "resurgo"."document_versions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_case_created_at_idx" ON "resurgo"."documents" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "professional_review_acknowledgements_revision_time_idx" ON "resurgo"."professional_review_acknowledgements" USING btree ("review_revision_id","occurred_at");--> statement-breakpoint
CREATE INDEX "professional_review_evidence_document_version_idx" ON "resurgo"."professional_review_evidence" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX "professional_review_revisions_review_time_idx" ON "resurgo"."professional_review_revisions" USING btree ("professional_review_id","created_at");--> statement-breakpoint
CREATE INDEX "professional_review_statements_revision_idx" ON "resurgo"."professional_review_statements" USING btree ("review_revision_id");--> statement-breakpoint
CREATE INDEX "professional_reviews_case_responsible_idx" ON "resurgo"."professional_reviews" USING btree ("case_id","responsible_case_membership_id");--> statement-breakpoint
CREATE FUNCTION "resurgo"."reject_immutable_record_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'immutable history records cannot be updated or deleted'
		USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "document_versions_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."document_versions"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "document_processing_events_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."document_processing_events"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "document_legal_hold_events_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."document_legal_hold_events"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "professional_review_revisions_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."professional_review_revisions"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "professional_review_statements_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."professional_review_statements"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "professional_review_evidence_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."professional_review_evidence"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "professional_review_acknowledgements_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."professional_review_acknowledgements"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();
