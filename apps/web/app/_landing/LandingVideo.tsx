"use client";
import { useId, useRef, useState } from "react";
import { Icon, buttonClasses } from "../../components/ui";

export interface LandingVideoLabels {
  name: string;
  playSound: string;
  play: string;
  caption: string;
  captions: string;
  fallback: string;
  /** Secondary action that opens the walkthrough. */
  walkthrough?: string;
  walkthroughTitle?: string;
  walkthroughNote?: string;
  close?: string;
}

/** A published video next to the primary one (the screen-recorded walkthrough under the promo). */
export interface LandingVideoSource {
  src: string;
  poster: string | null;
  track: string | null;
  audio: boolean;
}

/**
 * The product video (DIRECTION.md 12.7): native controls, poster first, preload metadata, plays inline, never autoplays,
 * and is muted only when the file has no audio track; a voiced film plays with sound once the viewer presses play
 * (it never autoplays, so sound still only follows a click). "Play with sound" plays it; it reads "Play" when the
 * file has no audio track (checked at build time). Nothing overlays the video: the buttons sit under the frame.
 * A soft teal-to-ocean halo sits behind the frame (`mx-glow`).
 *
 * `walkthrough` (when the primary is the promo) adds "Watch the full product walkthrough": a native modal <dialog>
 * (focus moves to its close button and returns on close; Escape, the close button or a click on the scrim close it;
 * the page behind is inert) with its own player.
 * Opening it is the click that starts that video; closing it pauses it. No autoplay attribute anywhere.
 */
export function LandingVideo({
  src,
  poster,
  track,
  audio,
  labels,
  walkthrough = null,
}: {
  src: string;
  poster: string | null;
  track: string | null;
  audio: boolean;
  labels: LandingVideoLabels;
  walkthrough?: LandingVideoSource | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const second = useRef<HTMLVideoElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [playing, setPlaying] = useState(false);
  const start = () => {
    const v = ref.current;
    if (!v) return;
    if (audio) v.muted = false;
    void v.play().catch(() => {
      /* the browser refused playback; the native controls stay available */
    });
  };
  const openWalkthrough = () => {
    const d = dialog.current;
    if (!d || !walkthrough) return;
    ref.current?.pause();
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
    void second.current?.play().catch(() => {
      /* refused: the native controls stay available */
    });
  };
  const closeWalkthrough = () => dialog.current?.close();

  const t = {
    walkthrough: labels.walkthrough ?? "Watch the full product walkthrough",
    title: labels.walkthroughTitle ?? "Full product walkthrough",
    note: labels.walkthroughNote,
    close: labels.close ?? "Close",
  };

  return (
    <figure className="mx-reveal mx-glow m-0 mx-auto w-full max-w-[1040px]">
      <div className="glass rounded-bento border border-sheet/70 p-2 shadow-float sm:p-3">
        <div className="overflow-hidden rounded-[20px] bg-ink">
          <video
            ref={ref}
            className="block aspect-video h-auto w-full bg-ink"
            controls
            muted={!audio}
            playsInline
            preload="metadata"
            poster={poster ?? undefined}
            aria-label={labels.name}
            data-audio={audio ? "true" : "false"}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          >
            <source src={src} type="video/mp4" />
            {track && <track kind="captions" src={track} srcLang="en" label={labels.captions} />}
            <a href={src}>{labels.fallback}</a>
          </video>
        </div>
      </div>
      <figcaption className="mt-5 flex flex-col items-center gap-3 text-center text-small text-ink-soft">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={start}
            aria-hidden={playing ? true : undefined}
            tabIndex={playing ? -1 : undefined}
            className={buttonClasses({ variant: "primary", size: "md", className: playing ? "invisible" : undefined })}
          >
            <Icon name={audio ? "audio-lines" : "play"} size={18} />
            {audio ? labels.playSound : labels.play}
          </button>
          {walkthrough && (
            <button type="button" onClick={openWalkthrough} aria-haspopup="dialog" className={buttonClasses({ variant: "secondary", size: "md" })}>
              <Icon name="circle-play" size={18} />
              {t.walkthrough}
            </button>
          )}
        </div>
        <span>{labels.caption}</span>
      </figcaption>
      {walkthrough && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          aria-describedby={t.note ? noteId : undefined}
          onClose={() => second.current?.pause()}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeWalkthrough(); // a click on the scrim, outside the panel
          }}
          className="mx-dialog m-auto w-[min(1100px,calc(100vw-32px))] max-w-none rounded-bento border border-sheet/70 bg-sheet p-0 text-ink shadow-float"
        >
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3 px-1 pt-1">
              <div className="min-w-0 text-left">
                <h2 id={titleId} className="text-h3 font-bold text-ink">
                  {t.title}
                </h2>
                {t.note && (
                  <p id={noteId} className="mt-0.5 text-small text-ink-soft">
                    {t.note}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeWalkthrough}
                aria-label={t.close}
                className="mx-press grid size-10 shrink-0 place-items-center rounded-full bg-muted text-ink transition-[background-color,scale,outline-offset] duration-quick ease-pen hover:bg-rule focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="overflow-hidden rounded-[20px] bg-ink">
              <video
                ref={second}
                className="block aspect-video h-auto max-h-[calc(100dvh-160px)] w-full bg-ink"
                controls
                playsInline
                preload="metadata"
                poster={walkthrough.poster ?? undefined}
                aria-label={t.title}
                data-audio={walkthrough.audio ? "true" : "false"}
              >
                <source src={walkthrough.src} type="video/mp4" />
                {walkthrough.track && <track kind="captions" src={walkthrough.track} srcLang="en" label={labels.captions} />}
                <a href={walkthrough.src}>{labels.fallback}</a>
              </video>
            </div>
          </div>
        </dialog>
      )}
    </figure>
  );
}
