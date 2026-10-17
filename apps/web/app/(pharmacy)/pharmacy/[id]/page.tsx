import { Workspace } from "../../_workspace";

export default async function PharmacySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace id={id} />;
}
