"use client";
import { QueueCard, QueueStats } from "./_queue";
import { useClinician } from "./_shell";
import { tr } from "./_i18n";

export default function ReviewIndex() {
  const { lang } = useClinician();
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <QueueStats />
      <p className="text-body text-ink-soft">{tr("queueHint", lang)}</p>
      <div className="max-h-[calc(100dvh-22rem)] min-h-[360px]"><QueueCard /></div>
    </div>
  );
}
