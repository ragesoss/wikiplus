import { Suspense } from "react";
import { TopicView } from "./TopicView";

export default function TopicPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink/50">Loading…</p>}>
      <TopicView />
    </Suspense>
  );
}
