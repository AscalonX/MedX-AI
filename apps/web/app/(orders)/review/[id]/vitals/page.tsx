import { Vitals } from "./_vitals";

export default async function VitalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Vitals id={id} />;
}
