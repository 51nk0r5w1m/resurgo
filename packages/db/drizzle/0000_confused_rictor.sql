CREATE SCHEMA "resurgo";
--> statement-breakpoint
CREATE TABLE "resurgo"."system_metadata" (
	"key" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
