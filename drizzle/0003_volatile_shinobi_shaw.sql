CREATE INDEX "clip_curator_id_idx" ON "clip" USING btree ("curator_id");--> statement-breakpoint
CREATE INDEX "clip_topic_id_idx" ON "clip" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "contributor_handle_idx" ON "contributor" USING btree ("handle");