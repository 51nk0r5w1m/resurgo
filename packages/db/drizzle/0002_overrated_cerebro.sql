CREATE TYPE "resurgo"."pilot_verification_status" AS ENUM('candidate', 'verified', 'suspended', 'ended');--> statement-breakpoint
CREATE TABLE "resurgo"."jurisdictions" (
	"code" text PRIMARY KEY NOT NULL,
	"state_code" text NOT NULL,
	"county_name" text NOT NULL,
	"court_name" text NOT NULL,
	"judicial_circuit" text NOT NULL,
	"source_url" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "jurisdictions_code_format_check" CHECK ("resurgo"."jurisdictions"."code" ~ '^[A-Z]{2}-[A-Z]+-SUPERIOR$')
);
--> statement-breakpoint
INSERT INTO "resurgo"."jurisdictions" (
	"code", "state_code", "county_name", "court_name", "judicial_circuit",
	"source_url", "enabled", "reviewed_at"
) VALUES
	(
		'GA-FULTON-SUPERIOR', 'GA', 'Fulton County',
		'Fulton County Superior Court', 'Atlanta Judicial Circuit',
		'https://www.fultonclerk.org/255/Divorce', true,
		'2026-10-30T00:00:00Z'
	),
	(
		'GA-DEKALB-SUPERIOR', 'GA', 'DeKalb County',
		'DeKalb County Superior Court', 'Stone Mountain Judicial Circuit',
		'https://www.dekalbsuperiorcourt.com/', true,
		'2026-10-30T00:00:00Z'
	);
--> statement-breakpoint
ALTER TABLE "resurgo"."cases" DROP CONSTRAINT "cases_jurisdiction_code_format_check";--> statement-breakpoint
ALTER TABLE "resurgo"."organizations" ADD COLUMN "pilot_status" "resurgo"."pilot_verification_status" DEFAULT 'candidate' NOT NULL;--> statement-breakpoint
ALTER TABLE "resurgo"."organizations" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resurgo"."organizations" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "resurgo"."cases" ADD CONSTRAINT "cases_jurisdiction_code_jurisdictions_code_fk" FOREIGN KEY ("jurisdiction_code") REFERENCES "resurgo"."jurisdictions"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."organizations" ADD CONSTRAINT "organizations_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."organizations" ADD CONSTRAINT "organizations_pilot_verification_check" CHECK (("resurgo"."organizations"."pilot_status" = 'candidate' and "resurgo"."organizations"."verified_at" is null and "resurgo"."organizations"."verified_by_user_id" is null) or ("resurgo"."organizations"."pilot_status" <> 'candidate' and "resurgo"."organizations"."verified_at" is not null and "resurgo"."organizations"."verified_by_user_id" is not null));
--> statement-breakpoint
CREATE FUNCTION "resurgo"."enforce_enabled_pilot_jurisdiction"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM "resurgo"."jurisdictions" AS jurisdiction
		WHERE jurisdiction."code" = NEW."jurisdiction_code"
			AND jurisdiction."enabled" = true
	) THEN
		RAISE EXCEPTION 'case jurisdiction is not enabled for the pilot'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "cases_enabled_pilot_jurisdiction_check"
BEFORE INSERT OR UPDATE OF "jurisdiction_code" ON "resurgo"."cases"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."enforce_enabled_pilot_jurisdiction"();
--> statement-breakpoint
CREATE FUNCTION "resurgo"."enforce_verified_pilot_professional"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."role" IN ('attorney', 'lender', 'accountant', 'mediator', 'support_professional')
		AND NOT EXISTS (
			SELECT 1
			FROM "resurgo"."organization_memberships" AS membership
			INNER JOIN "resurgo"."organizations" AS organization
				ON organization."id" = membership."organization_id"
			WHERE membership."id" = NEW."organization_membership_id"
				AND membership."user_id" = NEW."user_id"
				AND membership."status" = 'active'
				AND membership."valid_from" <= now()
				AND (membership."expires_at" IS NULL OR membership."expires_at" > now())
				AND organization."pilot_status" = 'verified'
		) THEN
		RAISE EXCEPTION 'professional case participation requires an active membership in a verified pilot organization'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "case_memberships_verified_pilot_professional_check"
BEFORE INSERT OR UPDATE OF "user_id", "organization_membership_id", "role", "status", "valid_from", "expires_at"
ON "resurgo"."case_memberships"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."enforce_verified_pilot_professional"();
