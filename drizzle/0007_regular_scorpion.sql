ALTER TABLE "clip" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clip" ADD COLUMN "removed_by" integer;--> statement-breakpoint
ALTER TABLE "clip" ADD COLUMN "removed_reason" text;--> statement-breakpoint
ALTER TABLE "clip" ADD CONSTRAINT "clip_removed_by_contributor_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."contributor"("id") ON DELETE set null ON UPDATE no action;