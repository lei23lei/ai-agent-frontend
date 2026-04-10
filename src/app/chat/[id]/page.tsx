export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Chat page coming in Phase 2 (session: {id})
    </div>
  );
}
