CREATE FUNCTION "resurgo"."enforce_case_owner_grant_basis"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."basis" = 'case_owner' AND NOT EXISTS (
		SELECT 1
		FROM "resurgo"."case_memberships" AS membership
		INNER JOIN "resurgo"."cases" AS case_record
			ON case_record."id" = membership."case_id"
		WHERE membership."case_id" = NEW."case_id"
			AND membership."id" = NEW."grantee_case_membership_id"
			AND membership."role" = 'owner'
			AND membership."user_id" = case_record."owner_user_id"
	) THEN
		RAISE EXCEPTION 'case_owner grant basis requires the case owner membership'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "resource_grants_case_owner_basis_check"
BEFORE INSERT OR UPDATE OF "basis", "case_id", "grantee_case_membership_id"
ON "resurgo"."resource_grants"
FOR EACH ROW EXECUTE FUNCTION "resurgo"."enforce_case_owner_grant_basis"();
