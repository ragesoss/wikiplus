ALTER TABLE "clip" ADD COLUMN "vetted" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "contributor" ADD COLUMN "is_moderator" boolean DEFAULT false NOT NULL;