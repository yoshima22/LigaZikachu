"use server";

import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { buildJournalPages } from "@/journal-data/build-pages";
import { JOURNAL_PUBLIC } from "@/journal-data/config";
import type { BookPage } from "./_components/journal-book";

/** Páginas do Journal para o botão do álbum. Jogadores logados (ou só admins, se JOURNAL_PUBLIC=false). */
export async function loadJournalPages(): Promise<BookPage[] | null> {
  const user = await getSessionUser();
  if (!user || (!JOURNAL_PUBLIC && !isAdmin(user.role))) return null;
  return buildJournalPages(user.id, false);
}
