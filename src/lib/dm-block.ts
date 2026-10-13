export type DirectMessageBlock = { blockerId: string; blockedId: string };

/** O bloqueio é direcional: quem silenciou deixa de receber DMs e anexos daquela pessoa. */
export function isDirectMessageBlocked(blocks: readonly DirectMessageBlock[], senderId: string, receiverId: string) {
  return blocks.some((block) => block.blockerId === receiverId && block.blockedId === senderId);
}
