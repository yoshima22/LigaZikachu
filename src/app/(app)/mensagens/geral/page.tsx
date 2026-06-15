import { getGeneralChatAction, type AttachmentData } from "../actions";
import { GeneralChat } from "./_components/general-chat";

export default async function GeneralChatPage() {
  const result = await getGeneralChatAction();

  return (
    <GeneralChat
      me={result.me}
      initialMessages={result.messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.sender.displayName,
        senderAvatar: m.sender.avatarUrl ?? null,
        createdAt: m.createdAt.toISOString(),
        attachmentType: m.attachmentType,
        attachmentData: (m.attachmentData as AttachmentData) ?? null,
      }))}
    />
  );
}
