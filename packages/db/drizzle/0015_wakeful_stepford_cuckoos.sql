CREATE TYPE "resurgo"."case_task_status" AS ENUM('open', 'blocked', 'completed', 'cancelled');--> statement-breakpoint
ALTER TYPE "resurgo"."resource_type" ADD VALUE 'case_task';--> statement-breakpoint
CREATE TABLE "resurgo"."settlement_feasibility_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"professional_review_id" uuid NOT NULL,
	"review_revision_id" uuid NOT NULL,
	"property_disposition" text NOT NULL,
	"existing_mortgage_responsibility" text NOT NULL,
	"proposed_pathway" text NOT NULL,
	"equity_buyout_amount" numeric(14, 2),
	"proposed_settlement_deadline" timestamp with time zone,
	"financing_assumptions" text NOT NULL,
	"lender_findings" text,
	"outstanding_conditions" text,
	"review_stage" text DEFAULT 'feasibility_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_feasibility_revision_unique" UNIQUE("review_revision_id"),
	CONSTRAINT "settlement_feasibility_disposition_check" CHECK ("resurgo"."settlement_feasibility_revisions"."property_disposition" in ('retain_by_client', 'retain_by_spouse', 'sell', 'undecided', 'other')),
	CONSTRAINT "settlement_feasibility_pathway_check" CHECK ("resurgo"."settlement_feasibility_revisions"."proposed_pathway" in ('refinance', 'assumption', 'sale', 'payoff', 'other', 'undecided')),
	CONSTRAINT "settlement_feasibility_stage_check" CHECK ("resurgo"."settlement_feasibility_revisions"."review_stage" in ('feasibility_review', 'preapproval', 'underwriting', 'closing')),
	CONSTRAINT "settlement_feasibility_buyout_check" CHECK ("resurgo"."settlement_feasibility_revisions"."equity_buyout_amount" is null or "resurgo"."settlement_feasibility_revisions"."equity_buyout_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "resurgo"."case_task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_task_id" uuid NOT NULL,
	"actor_case_membership_id" uuid NOT NULL,
	"status" "resurgo"."case_task_status" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resurgo"."case_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_resource_id" uuid NOT NULL,
	"source_discovery_output_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"responsible_role" text NOT NULL,
	"classification" "resurgo"."resource_classification" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_tasks_case_id_id_unique" UNIQUE("case_id","id"),
	CONSTRAINT "case_tasks_case_resource_unique" UNIQUE("case_id","case_resource_id"),
	CONSTRAINT "case_tasks_source_output_unique" UNIQUE("source_discovery_output_id"),
	CONSTRAINT "case_tasks_title_check" CHECK (length(trim("resurgo"."case_tasks"."title")) between 1 and 240),
	CONSTRAINT "case_tasks_description_check" CHECK (length(trim("resurgo"."case_tasks"."description")) between 1 and 4000),
	CONSTRAINT "case_tasks_role_check" CHECK ("resurgo"."case_tasks"."responsible_role" in ('client', 'attorney', 'lender', 'accountant', 'coordinator'))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."review_prerequisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"source_discovery_output_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"responsible_role" text NOT NULL,
	"status" text DEFAULT 'outstanding' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_prerequisites_output_unique" UNIQUE("source_discovery_output_id"),
	CONSTRAINT "review_prerequisites_status_check" CHECK ("resurgo"."review_prerequisites"."status" in ('outstanding', 'satisfied', 'waived'))
);
--> statement-breakpoint
ALTER TABLE "resurgo"."roadmap_items" ADD COLUMN "source_discovery_output_id" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."document_requests" ADD COLUMN "source_discovery_output_id" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD COLUMN "source_discovery_output_id" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_outputs" ADD CONSTRAINT "discovery_outputs_id_case_unique" UNIQUE("id","case_id");--> statement-breakpoint
ALTER TABLE "resurgo"."settlement_feasibility_revisions" ADD CONSTRAINT "settlement_feasibility_review_revision_fk" FOREIGN KEY ("case_id","professional_review_id","review_revision_id") REFERENCES "resurgo"."professional_review_revisions"("case_id","professional_review_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_task_events" ADD CONSTRAINT "case_task_events_task_fk" FOREIGN KEY ("case_id","case_task_id") REFERENCES "resurgo"."case_tasks"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_task_events" ADD CONSTRAINT "case_task_events_actor_fk" FOREIGN KEY ("case_id","actor_case_membership_id") REFERENCES "resurgo"."case_memberships"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_tasks" ADD CONSTRAINT "case_tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_tasks" ADD CONSTRAINT "case_tasks_resource_fk" FOREIGN KEY ("case_id","case_resource_id") REFERENCES "resurgo"."case_resources"("case_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."case_tasks" ADD CONSTRAINT "case_tasks_discovery_output_fk" FOREIGN KEY ("source_discovery_output_id","case_id") REFERENCES "resurgo"."discovery_outputs"("id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."review_prerequisites" ADD CONSTRAINT "review_prerequisites_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."review_prerequisites" ADD CONSTRAINT "review_prerequisites_discovery_output_fk" FOREIGN KEY ("source_discovery_output_id","case_id") REFERENCES "resurgo"."discovery_outputs"("id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_task_events_task_time_idx" ON "resurgo"."case_task_events" USING btree ("case_task_id","occurred_at");--> statement-breakpoint
CREATE INDEX "review_prerequisites_case_status_idx" ON "resurgo"."review_prerequisites" USING btree ("case_id","status");--> statement-breakpoint
ALTER TABLE "resurgo"."roadmap_items" ADD CONSTRAINT "roadmap_items_discovery_output_case_fk" FOREIGN KEY ("source_discovery_output_id","case_id") REFERENCES "resurgo"."discovery_outputs"("id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."document_requests" ADD CONSTRAINT "document_requests_discovery_output_case_fk" FOREIGN KEY ("source_discovery_output_id","case_id") REFERENCES "resurgo"."discovery_outputs"("id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_reviews" ADD CONSTRAINT "professional_reviews_discovery_output_case_fk" FOREIGN KEY ("source_discovery_output_id","case_id") REFERENCES "resurgo"."discovery_outputs"("id","case_id") ON DELETE restrict ON UPDATE no action;
