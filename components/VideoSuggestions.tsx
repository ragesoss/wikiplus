"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface YTVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

const YT_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";
const sansFont = "Source Sans 3, Source Sans Pro, system-ui, sans-serif";

async function searchYouTube(query: string): Promise<YTVideo[]> {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&q=${encodeURIComponent(query)}&type=video` +
    `&maxResults=5&key=${YT_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (
    (data.items ?? []) as Array<{
      id: { videoId?: string };
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
    }>
  )
    .map((item) => ({
      videoId: item.id?.videoId ?? "",
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        "",
    }))
    .filter((v) => v.videoId);
}

function contributePath(
  topicQid: string,
  topicTitle: string,
  extra: { videoUrl?: string; creator?: string; videoTitle?: string } = {}
) {
  const p = new URLSearchParams();
  if (topicQid) p.set("qid", topicQid);
  else p.set("title", topicTitle);
  if (extra.videoUrl) p.set("videoUrl", extra.videoUrl);
  if (extra.creator) p.set("creator", extra.creator);
  if (extra.videoTitle) p.set("videoTitle", extra.videoTitle);
  return `/contribute?${p.toString()}`;
}

function CandidateCard({
  video,
  topicQid,
  topicTitle,
  onDismiss,
}: {
  video: YTVideo;
  topicQid: string;
  topicTitle: string;
  onDismiss: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);

  function handleDismiss() {
    setDismissing(true);
    setTimeout(onDismiss, 300);
  }

  return (
    <article
      className={`border-2 border-dashed border-[#2C2C2C] bg-white overflow-hidden transition-all duration-300 ${
        dismissing ? "opacity-0 scale-[0.96]" : "opacity-100 scale-100"
      }`}
    >
      {/* Thumbnail — muted + hatch overlay reads as unvetted */}
      <div
        className="relative aspect-video overflow-hidden"
        style={{ filter: "saturate(0.55) contrast(0.95)" }}
      >
        {video.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {!video.thumbnail && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#676EB4] to-[#5248AF]" />
        )}
        {/* Diagonal hatch marks the card as provisional */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(44,44,44,.10) 0 6px, transparent 6px 12px)",
          }}
        />
        {/* Play icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#676EB4] border-2 border-[#2C2C2C] text-white">
            <svg
              className="w-4 h-4 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-2.5 space-y-2">
        {/* SUGGESTED badge + title */}
        <div className="flex items-start gap-2">
          <span
            className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 bg-white text-[#2C2C2C] border-2 border-[#2C2C2C]"
            style={{ fontFamily: sansFont }}
          >
            Suggested
          </span>
        </div>
        <p
          className="text-[12px] font-bold text-[#2C2C2C] line-clamp-2 leading-tight"
          style={{ fontFamily: sansFont }}
        >
          {video.title}
        </p>
        <p className="text-[11px] text-[#595959]" style={{ fontFamily: sansFont }}>
          {video.channelTitle}
        </p>

        {/* Reason line — dashed indigo left border */}
        <div className="border-l-4 border-dashed border-[#676EB4] bg-[#F0F1F3] pl-3 pr-2 py-2">
          <div
            className="flex items-center gap-1.5 mb-1"
            style={{ fontFamily: sansFont }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3 h-3 shrink-0 text-[#5248AF]"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5248AF]">
              Auto-suggested
            </span>
          </div>
          <p
            className="text-[11px] italic text-[#717171]"
            style={{ fontFamily: sansFont }}
          >
            No context yet — a human hasn&apos;t reviewed this.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href={contributePath(topicQid, topicTitle, {
              videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
              creator: video.channelTitle,
              videoTitle: video.title,
            })}
            className="text-[11px] font-bold text-white bg-[#676EB4] border-2 border-[#2C2C2C] px-2.5 py-1 hover:shadow-[2px_2px_0_#2C2C2C] transition-shadow"
            style={{ fontFamily: sansFont }}
          >
            ✓ Promote
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[11px] font-bold text-[#2C2C2C] bg-white border-2 border-[#2C2C2C] px-2.5 py-1 hover:bg-[#F0F1F3]"
            style={{ fontFamily: sansFont }}
            aria-label={`Dismiss ${video.title} as not relevant`}
          >
            ✕ Not relevant
          </button>
        </div>
      </div>
    </article>
  );
}

export function VideoSuggestions({
  topicTitle,
  topicQid,
}: {
  topicTitle: string;
  topicQid: string;
}) {
  const [videos, setVideos] = useState<YTVideo[] | null>(YT_KEY ? null : []);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!YT_KEY || !topicTitle) return;
    searchYouTube(`${topicTitle} explained`).then(setVideos);
  }, [topicTitle]);

  const visibleVideos = (videos ?? []).filter((v) => !dismissed.has(v.videoId));

  const tiktokUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(topicTitle)}`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topicTitle} explained`)}`;

  return (
    <div className="space-y-3 pb-12">
      {/* Loading skeletons */}
      {videos === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-2 border-dashed border-[#2C2C2C] bg-white p-3 animate-pulse"
            >
              <div className="aspect-video bg-[#D9D9D9] mb-2" />
              <div className="h-3 bg-[#D9D9D9] rounded w-3/4 mb-1.5" />
              <div className="h-2.5 bg-[#D9D9D9] rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Candidate cards from YouTube API */}
      {visibleVideos.length > 0 && (
        <div className="space-y-3">
          {visibleVideos.map((v) => (
            <CandidateCard
              key={v.videoId}
              video={v}
              topicQid={topicQid}
              topicTitle={topicTitle}
              onDismiss={() =>
                setDismissed((prev) => new Set([...prev, v.videoId]))
              }
            />
          ))}
        </div>
      )}

      {/* "Find more" row — always shown once loading is done */}
      {videos !== null && (
        <div className="space-y-2 pt-1">
          <div
            className="text-[10px] uppercase tracking-widest font-bold text-[#595959]"
            style={{ fontFamily: sansFont }}
          >
            Find more
          </div>
          <div className="flex flex-col gap-1.5">
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C2C2C] border-2 border-[#2C2C2C] bg-white px-2.5 py-1.5 hover:bg-pink-50 hover:shadow-[2px_2px_0_#2C2C2C] transition-shadow"
              style={{ fontFamily: sansFont }}
            >
              <span className="text-pink-500" aria-hidden="true">✦</span>
              Search TikTok ↗
            </a>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C2C2C] border-2 border-[#2C2C2C] bg-white px-2.5 py-1.5 hover:bg-[#F0F1F3] hover:shadow-[2px_2px_0_#2C2C2C] transition-shadow"
              style={{ fontFamily: sansFont }}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0 text-red-600"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M21.58 6.19a2.51 2.51 0 0 0-1.77-1.77C18.25 4 12 4 12 4s-6.25 0-7.81.42A2.51 2.51 0 0 0 2.42 6.19C2 7.75 2 12 2 12s0 4.25.42 5.81a2.51 2.51 0 0 0 1.77 1.77C5.75 20 12 20 12 20s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77C22 16.25 22 12 22 12s0-4.25-.42-5.81zM10 15.5v-7l6 3.5-6 3.5z" />
              </svg>
              Search YouTube ↗
            </a>
            <Link
              href={contributePath(topicQid, topicTitle)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#676EB4] border-2 border-[#2C2C2C] px-2.5 py-1.5 hover:bg-[#5248AF] hover:shadow-[2px_2px_0_#2C2C2C] transition-all"
              style={{ fontFamily: sansFont }}
            >
              ＋ Add video
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
