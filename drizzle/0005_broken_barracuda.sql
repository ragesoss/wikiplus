CREATE TABLE "write_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributor_id" integer NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "write_event" ADD CONSTRAINT "write_event_contributor_id_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "write_event_contributor_created_idx" ON "write_event" USING btree ("contributor_id","created_at");