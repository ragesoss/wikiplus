import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { VideoThumb, type ThumbVideo } from "@/components/topic/VideoThumb";

// QA verification of docs/specs/instagram-resolve.md AC5 (failing thumbnail → gradient) and AC7
// (render loads nothing from Instagram beyond the lazy thumbnail; the iframe waits for a click).

const reel: ThumbVideo = {
  platform: "instagram",
  platformLabel: "Instagram",
  orientation: "vertical",
  caption: "Reel clip",
  watchUrl: "https://www.instagram.com/reel/DbtdaXkjXsL/",
  embedUrl: "https://www.instagram.com/reel/DbtdaXkjXsL/embed/",
  thumbnailUrl: "/api/thumb/instagram/DbtdaXkjXsL",
};

describe("VideoThumb — Instagram thumbnail (AC5 / AC7)", () => {
  it("renders only a lazy thumbnail through the wiki+ redirect path — no iframe before a click", () => {
    const { container } = render(<VideoThumb video={reel} onPlay={() => {}} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/api/thumb/instagram/DbtdaXkjXsL");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("a failing thumbnail falls back to the gradient", () => {
    const { container } = render(<VideoThumb video={reel} onPlay={() => {}} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("span.bg-gradient-to-br")).not.toBeNull();
  });
});
