import { notFound } from "next/navigation";
import { getConversationAction, type AttachmentData } from "../actions";
import { DmChat } from "./_components/dm-chat";

interface Props { params: Promise<{ playerId: string }> }

export default async function ConversationPage({ params }: Props) {
  const { playerId } = await params;
  const result = await getConversationAction(playerId);

  if (!result.ok) notFound();

  return (
    <DmChat
      me={result.me}
      other={result.other}
      initialMessages={result.messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderId === result.me.id ? result.me.displayName : result.other.displayName,
        senderAvatar: m.senderId === result.me.id ? null : result.other.avatarUrl ?? null,
        createdAt: m.createdAt.toISOString(),
        attachmentType: m.attachmentType,
        attachmentData: (m.attachmentData as AttachmentData) ?? null,
      }))}
    />
  );
}
