"use client";
import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

type Common = { label: string; hint?: string; error?: string };
type InputProps = Common & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type AreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };

/** Label above, hint below the label, error below the control. No placeholder-as-label. */
export function Field(props: InputProps | AreaProps) {
  const { label, hint, error, className, multiline, ...rest } = props;
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const control = cx(
    "w-full rounded-control border bg-sheet px-3 text-body text-ink",
    "transition-[border-color] duration-quick ease-pen focus-visible:border-ink",
    error ? "border-signal" : "border-rule-strong hover:border-ink-soft",
    multiline ? "min-h-24 py-2" : "h-10",
    className,
  );
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-ink-soft">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-micro text-graphite">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy} className={control} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={control} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error && (
        <p id={errId} className="text-small text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
