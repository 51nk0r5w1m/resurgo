CREATE TABLE "resurgo"."discovery_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"classification" text NOT NULL,
	"rule_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_outputs_session_generation_code_unique" UNIQUE("discovery_session_id","generation","code"),
	CONSTRAINT "discovery_outputs_type_check" CHECK ("resurgo"."discovery_outputs"."type" in ('document_request', 'review_trigger')),
	CONSTRAINT "discovery_outputs_classification_check" CHECK ("resurgo"."discovery_outputs"."classification" in ('shared', 'legal', 'financial', 'health'))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."document_comment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"actor_case_membership_id" uuid NOT NULL,
	"status" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_comment_events_status_check" CHECK ("resurgo"."document_comment_events"."status" in ('open', 'resolved', 'reopened'))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"author_case_membership_id" uuid NOT NULL,
	"kind" text DEFAULT 'comment' NOT NULL,
	"body" text NOT NULL,
	"anchor" jsonb,
	"parent_comment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_comments_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "document_comments_kind_check" CHECK ("resurgo"."document_comments"."kind" in ('comment', 'highlight')),
	CONSTRAINT "document_comments_body_check" CHECK (length(trim("resurgo"."document_comments"."body")) between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" DROP CONSTRAINT "discovery_answers_question_key_check";--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD COLUMN "definition_version" text DEFAULT 'atlanta-pilot-2026.1' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD COLUMN "answer_status" text DEFAULT 'answered' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD COLUMN "source" text DEFAULT 'client_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD COLUMN "classification" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD COLUMN "document_version_id" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_sessions" ADD COLUMN "definition_version" text DEFAULT 'atlanta-pilot-2026.1' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD COLUMN "archived_by_case_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_outputs" ADD CONSTRAINT "discovery_outputs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_outputs" ADD CONSTRAINT "discovery_outputs_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "resurgo"."discovery_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_outputs" ADD CONSTRAINT "discovery_outputs_session_case_fk" FOREIGN KEY ("discovery_session_id","case_id") REFERENCES "resurgo"."discovery_sessions"("id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_comment_events" ADD CONSTRAINT "document_comment_events_comment_fk" FOREIGN KEY ("case_id","comment_id") REFERENCES "resurgo"."document_comments"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_comment_events" ADD CONSTRAINT "document_comment_events_actor_fk" FOREIGN KEY ("case_id","actor_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_comments" ADD CONSTRAINT "document_comments_version_fk" FOREIGN KEY ("case_id","document_id","document_version_id") REFERENCES "resurgo"."document_versions"("case_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_comments" ADD CONSTRAINT "document_comments_author_fk" FOREIGN KEY ("case_id","author_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_comments" ADD CONSTRAINT "document_comments_parent_fk" FOREIGN KEY ("case_id","parent_comment_id") REFERENCES "resurgo"."document_comments"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_outputs_case_generation_idx" ON "resurgo"."discovery_outputs" USING btree ("case_id","generation");--> statement-breakpoint
CREATE INDEX "document_comment_events_comment_time_idx" ON "resurgo"."document_comment_events" USING btree ("comment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "document_comments_version_created_idx" ON "resurgo"."document_comments" USING btree ("document_version_id","created_at");--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD CONSTRAINT "documents_archived_by_membership_fk" FOREIGN KEY ("case_id","archived_by_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD CONSTRAINT "discovery_answers_status_check" CHECK ("resurgo"."discovery_answers"."answer_status" in ('answered', 'unknown', 'not_applicable', 'deferred'));--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD CONSTRAINT "discovery_answers_source_check" CHECK ("resurgo"."discovery_answers"."source" in ('client_reported', 'document_reported', 'professional_reported'));--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD CONSTRAINT "discovery_answers_verification_check" CHECK ("resurgo"."discovery_answers"."verification_status" in ('unverified', 'client_confirmed', 'document_verified', 'professional_reviewed'));--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD CONSTRAINT "discovery_answers_classification_check" CHECK ("resurgo"."discovery_answers"."classification" in ('shared', 'legal', 'financial', 'health'));--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD CONSTRAINT "discovery_answers_question_key_check" CHECK (length("resurgo"."discovery_answers"."question_key") between 1 and 120 and "resurgo"."discovery_answers"."question_key" ~ '^[a-z][a-z0-9_]*$');--> statement-breakpoint
ALTER TABLE "resurgo"."documents" ADD CONSTRAINT "documents_archive_state_check" CHECK (("resurgo"."documents"."archived_at" is null and "resurgo"."documents"."archived_by_case_membership_id" is null) or ("resurgo"."documents"."archived_at" is not null and "resurgo"."documents"."archived_by_case_membership_id" is not null));