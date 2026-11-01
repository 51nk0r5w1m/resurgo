CREATE UNIQUE INDEX "professional_review_revisions_single_successor_idx"
ON "resurgo"."professional_review_revisions" ("supersedes_revision_id")
WHERE "supersedes_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE FUNCTION "resurgo"."validate_professional_review_revision_lineage"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	predecessor_revision integer;
BEGIN
	IF NEW.revision = 1 THEN
		RETURN NEW;
	END IF;

	SELECT revision INTO predecessor_revision
	FROM resurgo.professional_review_revisions
	WHERE case_id = NEW.case_id
		AND professional_review_id = NEW.professional_review_id
		AND id = NEW.supersedes_revision_id;

	IF predecessor_revision IS NULL OR predecessor_revision <> NEW.revision - 1 THEN
		RAISE EXCEPTION 'professional review revision must supersede its immediate predecessor'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "professional_review_revision_lineage_enforced"
BEFORE INSERT ON "resurgo"."professional_review_revisions"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."validate_professional_review_revision_lineage"();--> statement-breakpoint
CREATE FUNCTION "resurgo"."require_attorney_acknowledgement_actor"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM resurgo.case_memberships
		WHERE case_id = NEW.case_id
			AND id = NEW.attorney_case_membership_id
			AND role = 'attorney'
	) THEN
		RAISE EXCEPTION 'review acknowledgement actor must be an attorney'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "professional_review_acknowledgement_attorney_enforced"
BEFORE INSERT ON "resurgo"."professional_review_acknowledgements"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."require_attorney_acknowledgement_actor"();
