"use client";
import { QueueCard, QueueStats } from "./_queue";
import { useClinician } from "./_shell";
import { tr } from "./_i18n";

export default function ReviewIndex() {
  const { lang } = useClinician();
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <header className="cl-enter">
        <h1 className="text-title font-extrabold text-ink">{tr("queueTitle", lang)}</h1>
        <p className="mt-1 max-w-[70ch] text-body text-ink-soft">{tr("queueHint", lang)}</p>
      </header>
      <QueueStats />
      <div className="flex max-h-[calc(100dvh-22rem)] min-h-[420px] flex-col"><QueueCard /></div>
    </div>
  );
}
