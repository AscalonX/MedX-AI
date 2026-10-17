import { Orders } from "./_orders";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Orders id={id} />;
}
