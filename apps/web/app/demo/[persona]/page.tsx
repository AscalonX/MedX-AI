import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_PERSONAS } from "@medx/shared";
import { personaById } from "../../_landing/demo";
import { Launcher } from "./Launcher";

// /demo/<persona id>: records the demo identity, then opens that persona's synthetic case (see Launcher).
// One static page per DEMO_PERSONAS entry; any other id is a 404. Not indexed: opening it starts a demo case.
export const dynamicParams = false;
export function generateStaticParams() {
  return DEMO_PERSONAS.map((p) => ({ persona: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ persona: string }> }): Promise<Metadata> {
  const p = personaById((await params).persona);
  return { title: p ? `Demo as ${p.label}` : "Demo", robots: { index: false, follow: false } };
}

export default async function PersonaPage({ params }: { params: Promise<{ persona: string }> }) {
  const p = personaById((await params).persona);
  if (!p) notFound();
  return <Launcher personaId={p.id} />;
}
