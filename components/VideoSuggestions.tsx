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

export function VideoSuggestions({
  topicTitle,
  topicQid,
}: {
  topicTitle: string;
  topicQid: string;
}) {
  // null = loading; [] = done (no results or no key)
  const [videos, setVideos] = useState<YTVideo[] | null>(YT_KEY ? null : []);

  useEffect(() => {
    if (!YT_KEY || !topicTitle) return;
    searchYouTube(`${topicTitle} explained`).then(setVideos);
  }, [topicTitle]);

  const searchQueries = [
    `${topicTitle} explained`,
    `${topicTitle} overview`,
    `${topicTitle} documentary`,
  ];

  const sansFont =
    "Source Sans 3, Source Sans Pro, system-ui, sans-serif";

  return (
    <div className="space-y-3 pb-12">
      {/* Section label */}
      <div
        className="text-[11px] uppercase tracking-widest font-bold text-[#5248AF] px-1 mb-2"
        style={{ fontFamily: sansFont }}
      >
        {YT_KEY ? "Suggested Videos ↓" : "Find Videos ↓"}
      </div>

      {/* Loading skeletons */}
      {videos === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] bg-white p-3 animate-pulse"
            >
              <div className="aspect-video bg-[#D9D9D9] mb-2" />
              <div className="h-3 bg-[#D9D9D9] rounded w-3/4 mb-1.5" />
              <div className="h-2.5 bg-[#D9D9D9] rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* YouTube API results */}
      {videos && videos.length > 0 && (
        <div className="space-y-3">
          {videos.map((v) => (
            <div
              key={v.videoId}
              className="border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] bg-white overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gradient-to-br from-[#676EB4] to-[#5248AF]">
                {v.thumbnail && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={v.thumbnail}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {/* Duotone overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(103,110,180,.35), rgba(82,72,175,.15))",
                    mixBlendMode: "multiply",
                  }}
                />
                <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                  YouTube
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#676EB4] border-2 border-white/80 opacity-90">
                    <svg
                      className="w-4 h-4 text-white ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-2.5 space-y-1.5">
                <p className="text-[12px] font-bold text-[#2C2C2C] line-clamp-2 leading-tight">
                  {v.title}
                </p>
                <p className="text-[11px] text-[#595959]">{v.channelTitle}</p>
                <div className="flex items-center gap-2 pt-0.5">
                  <a
                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#3366cc] hover:underline"
                  >
                    Watch ↗
                  </a>
                  <Link
                    href={contributePath(topicQid, topicTitle, {
                      videoUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                      creator: v.channelTitle,
                      videoTitle: v.title,
                    })}
                    className="text-[11px] text-white bg-[#676EB4] border-2 border-[#2C2C2C] px-2 py-0.5 font-bold hover:bg-[#5248AF] transition-colors"
                    style={{ fontFamily: sansFont }}
                  >
                    ＋ Add this clip
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No-key fallback OR no results */}
      {videos !== null && videos.length === 0 && (
        <div className="space-y-3">
          {/* YouTube search shortcuts */}
          <div className="border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] bg-white p-3">
            <p
              className="text-[10px] uppercase tracking-widest font-bold text-[#5248AF] mb-2"
              style={{ fontFamily: sansFont }}
            >
              Search YouTube
            </p>
            <div className="space-y-1.5">
              {searchQueries.map((q) => (
                <a
                  key={q}
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[12px] text-[#3366cc] hover:underline py-0.5"
                >
                  {/* YouTube wordmark icon */}
                  <svg
                    className="w-3.5 h-3.5 shrink-0 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M21.58 6.19a2.51 2.51 0 0 0-1.77-1.77C18.25 4 12 4 12 4s-6.25 0-7.81.42A2.51 2.51 0 0 0 2.42 6.19C2 7.75 2 12 2 12s0 4.25.42 5.81a2.51 2.51 0 0 0 1.77 1.77C5.75 20 12 20 12 20s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77C22 16.25 22 12 22 12s0-4.25-.42-5.81zM10 15.5v-7l6 3.5-6 3.5z" />
                  </svg>
                  {q}
                </a>
              ))}
            </div>
          </div>

          {/* Add clip CTA */}
          <Link
            href={contributePath(topicQid, topicTitle)}
            className="block text-center bg-[#676EB4] text-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] px-4 py-2.5 text-sm font-bold hover:bg-[#5248AF] transition-colors"
            style={{ fontFamily: sansFont }}
          >
            ＋ Add a clip
          </Link>
        </div>
      )}
    </div>
  );
}
