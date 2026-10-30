CREATE UNIQUE INDEX "professional_review_revisions_single_root_idx"
ON "resurgo"."professional_review_revisions" ("case_id", "professional_review_id")
WHERE "revision" = 1;--> statement-breakpoint
ALTER TABLE "resurgo"."professional_review_revisions"
ADD CONSTRAINT "professional_review_revisions_lineage_shape_check"
CHECK (
  ("revision" = 1 AND "supersedes_revision_id" IS NULL)
  OR ("revision" > 1 AND "supersedes_revision_id" IS NOT NULL)
);
