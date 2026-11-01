CREATE TYPE "resurgo"."document_request_status" AS ENUM('requested', 'submitted', 'completed', 'cancelled');--> statement-breakpoint
ALTER TYPE "resurgo"."resource_type" ADD VALUE 'document_request' BEFORE 'professional_review';--> statement-breakpoint
CREATE TABLE "resurgo"."document_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_request_id" uuid NOT NULL,
	"status" "resurgo"."document_request_status" NOT NULL,
	"actor_case_membership_id" uuid NOT NULL,
	"document_id" uuid,
	"document_version_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_request_events_version_check" CHECK (("resurgo"."document_request_events"."status" in ('submitted', 'completed') and "resurgo"."document_request_events"."document_id" is not null and "resurgo"."document_request_events"."document_version_id" is not null) or ("resurgo"."document_request_events"."status" in ('requested', 'cancelled') and "resurgo"."document_request_events"."document_id" is null and "resurgo"."document_request_events"."document_version_id" is null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_resource_id" uuid NOT NULL,
	"requested_by_case_membership_id" uuid NOT NULL,
	"assigned_to_case_membership_id" uuid,
	"classification" "resurgo"."resource_classification" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_requests_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "document_requests_case_resource_unique" UNIQUE("case_id","case_resource_id"),
	CONSTRAINT "document_requests_title_check" CHECK (length(trim("resurgo"."document_requests"."title")) between 1 and 240),
	CONSTRAINT "document_requests_description_check" CHECK (length(trim("resurgo"."document_requests"."description")) between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "resurgo"."document_request_events" ADD CONSTRAINT "document_request_events_request_fk" FOREIGN KEY ("case_id","document_request_id") REFERENCES "resurgo"."document_requests"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_request_events" ADD CONSTRAINT "document_request_events_actor_fk" FOREIGN KEY ("case_id","actor_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_request_events" ADD CONSTRAINT "document_request_events_version_fk" FOREIGN KEY ("case_id","document_id","document_version_id") REFERENCES "resurgo"."document_versions"("case_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_requests" ADD CONSTRAINT "document_requests_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_requests" ADD CONSTRAINT "document_requests_case_resource_fk" FOREIGN KEY ("case_id","case_resource_id") REFERENCES "resurgo"."case_resources"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_requests" ADD CONSTRAINT "document_requests_requester_fk" FOREIGN KEY ("case_id","requested_by_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_requests" ADD CONSTRAINT "document_requests_assignee_fk" FOREIGN KEY ("case_id","assigned_to_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_request_events_request_time_idx" ON "resurgo"."document_request_events" USING btree ("document_request_id","occurred_at");--> statement-breakpoint
CREATE INDEX "document_requests_case_created_at_idx" ON "resurgo"."document_requests" USING btree ("case_id","created_at");
--> statement-breakpoint
CREATE TRIGGER "document_request_events_immutable"
BEFORE UPDATE OR DELETE ON "resurgo"."document_request_events"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."reject_immutable_record_mutation"();
