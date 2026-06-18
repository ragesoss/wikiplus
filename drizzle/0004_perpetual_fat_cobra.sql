CREATE TABLE "clip_vote" (
	"id" serial PRIMARY KEY NOT NULL,
	"clip_id" integer NOT NULL,
	"contributor_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clip_vote_identity" UNIQUE("clip_id","contributor_id")
);
--> statement-breakpoint
ALTER TABLE "clip_vote" ADD CONSTRAINT "clip_vote_clip_id_clip_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_vote" ADD CONSTRAINT "clip_vote_contributor_id_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributor"("id") ON DELETE cascade ON UPDATE no action;