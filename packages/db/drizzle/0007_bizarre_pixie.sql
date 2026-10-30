CREATE TYPE "resurgo"."discovery_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "resurgo"."recommendation_service" AS ENUM('divorce_attorney', 'mortgage_specialist', 'financial_specialist', 'personal_support');--> statement-breakpoint
CREATE TYPE "resurgo"."roadmap_status" AS ENUM('upcoming', 'ready', 'completed');--> statement-breakpoint
CREATE TABLE "resurgo"."discovery_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"answer" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_answers_session_question_revision_unique" UNIQUE("discovery_session_id","question_key","revision"),
	CONSTRAINT "discovery_answers_question_key_check" CHECK ("resurgo"."discovery_answers"."question_key" in ('property_status', 'mortgage_status', 'financial_complexity', 'support_interest'))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."discovery_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"status" "resurgo"."discovery_status" DEFAULT 'in_progress' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_sessions_case_unique" UNIQUE("case_id"),
	CONSTRAINT "discovery_sessions_completion_check" CHECK (("resurgo"."discovery_sessions"."status" = 'completed' and "resurgo"."discovery_sessions"."completed_at" is not null) or ("resurgo"."discovery_sessions"."status" = 'in_progress' and "resurgo"."discovery_sessions"."completed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "resurgo"."recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"rule_version" text NOT NULL,
	"service" "resurgo"."recommendation_service" NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_session_generation_service_unique" UNIQUE("discovery_session_id","generation","service")
);
--> statement-breakpoint
CREATE TABLE "resurgo"."roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "resurgo"."roadmap_status" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_items_case_generation_position_unique" UNIQUE("case_id","generation","position")
);
--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_answers" ADD CONSTRAINT "discovery_answers_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "resurgo"."discovery_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_sessions" ADD CONSTRAINT "discovery_sessions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."recommendations" ADD CONSTRAINT "recommendations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."recommendations" ADD CONSTRAINT "recommendations_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "resurgo"."discovery_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."roadmap_items" ADD CONSTRAINT "roadmap_items_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "resurgo"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."roadmap_items" ADD CONSTRAINT "roadmap_items_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "resurgo"."recommendations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_answers_session_revision_idx" ON "resurgo"."discovery_answers" USING btree ("discovery_session_id","revision");--> statement-breakpoint
CREATE INDEX "recommendations_case_generation_idx" ON "resurgo"."recommendations" USING btree ("case_id","generation");--> statement-breakpoint
CREATE INDEX "roadmap_items_case_generation_idx" ON "resurgo"."roadmap_items" USING btree ("case_id","generation");