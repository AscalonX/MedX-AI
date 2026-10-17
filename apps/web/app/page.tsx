import Link from "next/link";

const surfaces = [
  { href: "/review", name: "Clinician review", text: "The nurse or GP reads a one-screen summary. Every field links to the patient's own sentence; nothing is final until a clinician approves." },
  { href: "/ops", name: "Ops dashboard", text: "The ward board: escalations first, the queue by urgency, and how the model is performing." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[46rem] flex-col justify-center px-6 py-12">
      <div className="bg-sheet px-8 py-10 shadow-sheet">
        <h1 className="text-title">MedX Bridge</h1>
        <p className="mt-2 max-w-[52ch] text-body text-ink-soft">
          Multilingual pre-visit intake in Thai, Italian and English. It structures what the patient said so a clinician can review it. It does not diagnose.
        </p>
        <ul className="mt-8 border-t border-rule">
          {surfaces.map((s) => (
            <li key={s.href} className="border-b border-rule">
              <Link href={s.href} className="flex flex-col gap-0.5 py-3 hover:bg-paper focus-visible:-outline-offset-2">
                <span className="font-medium underline underline-offset-4">{s.name}</span>
                <span className="max-w-[56ch] text-small text-ink-soft">{s.text}</span>
              </Link>
            </li>
          ))}
          <li className="border-b border-rule py-3">
            <p className="font-medium">Patient app</p>
            <p className="max-w-[56ch] text-small text-ink-soft">
              An Expo app that runs on the patient&apos;s phone (apps/mobile), not a web page. To see what a clinician receives from it, open a{" "}
              <Link href="/review" className="underline underline-offset-4">demo review</Link>.
            </p>
          </li>
        </ul>
        <p className="mt-8 text-micro text-graphite">Decision support. Research prototype. Synthetic data only. Not a medical device.</p>
      </div>
    </main>
  );
}
