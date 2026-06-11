import { getInboxAction } from "./actions";
import { InboxWithSearch } from "./_components/inbox-with-search";

export default async function MensagensPage() {
  const result = await getInboxAction();
  if (!result.ok) return null;

  return (
    <InboxWithSearch
      conversations={result.conversations}
      allPlayers={result.allPlayers}
    />
  );
}
