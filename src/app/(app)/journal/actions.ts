"use server";

import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { buildJournalPages } from "@/journal-data/build-pages";
import type { BookPage } from "./_components/journal-book";

/** Páginas do Journal para o botão do álbum. Só admins (protótipo). */
export async function loadJournalPages(): Promise<BookPage[] | null> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  return buildJournalPages(user.id, false);
}
