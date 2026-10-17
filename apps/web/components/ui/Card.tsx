import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

/** White card: radius 22, diffuse navy shadow, hairline border. The default container. */
export function Card({
  padded = true,
  interactive = false,
  className,
  children,
  ...rest
}: { padded?: boolean; interactive?: boolean; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-card border border-rule/70 bg-sheet shadow-sheet",
        padded && "p-5",
        interactive && "transition-[transform,box-shadow] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card header row: title left, optional action right. */
export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lead font-bold text-ink">{title}</h2>
      {action}
    </div>
  );
}
