CREATE TABLE "account" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributor_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_provider_identity" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "clip" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"platform" text NOT NULL,
	"platform_label" text NOT NULL,
	"orientation" text NOT NULL,
	"watch_url" text NOT NULL,
	"embed_url" text,
	"thumbnail_url" text,
	"thumb_grad" text,
	"caption" text NOT NULL,
	"creator_handle" text NOT NULL,
	"creator_name" text NOT NULL,
	"creator_platform" text NOT NULL,
	"creator_url" text,
	"creator_avatar_grad" text,
	"creator_follower_count" integer,
	"general" boolean DEFAULT false NOT NULL,
	"section_slug" text,
	"section_label" text,
	"context_note" text NOT NULL,
	"stance" text NOT NULL,
	"stance_modifier" text,
	"accuracy_flag" text NOT NULL,
	"accuracy_modifier" text,
	"upvotes" integer,
	"curated_by" text,
	"curated_at" text,
	"curator_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributor" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributor_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "dismissed_candidate" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_video_id" text NOT NULL,
	"contributor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dismissed_candidate_identity" UNIQUE("topic_id","provider","provider_video_id")
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" serial PRIMARY KEY NOT NULL,
	"wikidata_qid" text NOT NULL,
	"title" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_wikidata_qid_unique" UNIQUE("wikidata_qid")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_contributor_id_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip" ADD CONSTRAINT "clip_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip" ADD CONSTRAINT "clip_curator_id_contributor_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."contributor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_candidate" ADD CONSTRAINT "dismissed_candidate_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_candidate" ADD CONSTRAINT "dismissed_candidate_contributor_id_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributor"("id") ON DELETE set null ON UPDATE no action;