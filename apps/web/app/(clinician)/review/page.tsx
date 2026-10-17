export default function ReviewIndex() {
  return (
    <section className="flex flex-1 flex-col gap-2 bg-sheet p-8 shadow-sheet">
      <h1 className="text-title">Select an intake</h1>
      <p className="max-w-[46ch] text-body text-ink-soft">Choose a code in the queue. Escalated intakes are pinned at the top.</p>
    </section>
  );
}
