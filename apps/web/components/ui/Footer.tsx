import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { cx } from "./cx";

/**
 * Marketing footer (DIRECTION.md 12): vector logo, the claim-boundary disclaimer in full (research prototype,
 * supports clinicians, synthetic data only, not a medical device), optional link columns and a small note.
 * The disclaimer is required: the footer never ships without it.
 */
export function Footer({
  disclaimer,
  columns = [],
  note,
  homeHref = "/",
  homeLabel = "MedX home",
  navLabel = "Footer",
  className,
  children,
}: {
  disclaimer: ReactNode;
  columns?: { title: ReactNode; links: { href: string; label: ReactNode }[] }[];
  /** Last line, e.g. "Built for AMD Developer Hackathon ACT III, Track 2." */
  note?: ReactNode;
  homeHref?: string;
  homeLabel?: string;
  navLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <footer className={cx("px-4 pb-10 pt-12 sm:px-8", className)}>
      <div className="mx-auto max-w-page border-t border-rule pt-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-[46ch]">
            <Link href={homeHref} aria-label={homeLabel} className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean">
              <Logo height={30} />
            </Link>
            <p className="mt-4 text-small text-ink-soft">{disclaimer}</p>
          </div>
          {columns.length > 0 && (
            <nav aria-label={navLabel} className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {columns.map((c, i) => (
                <div key={i}>
                  <p className="text-small font-bold text-ink">{c.title}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {c.links.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} className="text-small text-ink-soft underline-offset-4 hover:text-ocean hover:underline">
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </div>
        {children}
        {note && <p className="mt-10 text-micro text-graphite">{note}</p>}
      </div>
    </footer>
  );
}
