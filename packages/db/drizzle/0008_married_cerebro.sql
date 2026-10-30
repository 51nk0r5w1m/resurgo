INSERT INTO "resurgo"."discovery_sessions" ("case_id")
SELECT "id" FROM "resurgo"."cases"
ON CONFLICT ("case_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "resurgo"."discovery_sessions" ADD CONSTRAINT "discovery_sessions_id_case_unique" UNIQUE("id","case_id");--> statement-breakpoint
ALTER TABLE "resurgo"."recommendations" ADD CONSTRAINT "recommendations_id_case_unique" UNIQUE("id","case_id");--> statement-breakpoint
ALTER TABLE "resurgo"."recommendations" ADD CONSTRAINT "recommendations_session_case_fk" FOREIGN KEY ("discovery_session_id","case_id") REFERENCES "resurgo"."discovery_sessions"("id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resurgo"."roadmap_items" ADD CONSTRAINT "roadmap_items_recommendation_case_fk" FOREIGN KEY ("recommendation_id","case_id") REFERENCES "resurgo"."recommendations"("id","case_id") ON DELETE restrict ON UPDATE no action;
