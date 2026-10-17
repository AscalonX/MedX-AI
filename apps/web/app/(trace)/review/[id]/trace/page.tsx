import { Trace } from "./_trace";

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Trace id={id} />;
}
