import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The product video (DIRECTION.md 12): a glass frame with a dark 16:9 stage, native controls, poster first.
 * Never autoplays with sound; loads only metadata until the viewer presses play. `title` is the accessible name.
 * Default source: /media/medx-demo.mp4 with /media/medx-demo-poster.jpg.
 * A soft teal-to-ocean halo sits behind the frame (`mx-glow`); the frame reveals on scroll.
 */
export function VideoFrame({
  src = "/media/medx-demo.mp4",
  poster = "/media/medx-demo-poster.jpg",
  title,
  caption,
  tracks = [],
  fallback,
  className,
}: {
  src?: string;
  poster?: string;
  /** Accessible name, e.g. "MedX in 60 seconds". */
  title: string;
  /** Visible caption under the frame. */
  caption?: ReactNode;
  /** Caption / subtitle files (WebVTT). */
  tracks?: { src: string; srcLang: string; label: string; kind?: "captions" | "subtitles"; default?: boolean }[];
  /** Shown by browsers that cannot play the video, e.g. a download link text. */
  fallback?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cx("mx-reveal mx-glow mx-auto m-0 w-full max-w-[1040px]", className)}>
      <div className="glass rounded-bento border border-sheet/70 p-2 shadow-float sm:p-3">
        <div className="overflow-hidden rounded-[20px] bg-ink">
          <video className="block aspect-video h-auto w-full bg-ink" controls preload="metadata" playsInline poster={poster} aria-label={title}>
            <source src={src} type="video/mp4" />
            {tracks.map((t) => (
              <track key={t.src} kind={t.kind ?? "captions"} src={t.src} srcLang={t.srcLang} label={t.label} default={t.default} />
            ))}
            <a href={src}>{fallback ?? title}</a>
          </video>
        </div>
      </div>
      {caption && <figcaption className="mt-4 text-center text-small text-ink-soft">{caption}</figcaption>}
    </figure>
  );
}
