"use server";

import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getJournalChunk, getJournalMeta } from "@/journal-data/build-pages";
import { JOURNAL_PUBLIC } from "@/journal-data/config";
import type { JournalMeta } from "@/journal-data/types";
import type { BookPage } from "./_components/journal-book";

/** Jogadores logados (ou só admins, se JOURNAL_PUBLIC=false). "Ver tudo" é só admin. */
async function access(revealAll: boolean) {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = isAdmin(user.role);
  if (!JOURNAL_PUBLIC && !admin) return null;
  return { userId: user.id, revealAll: revealAll && admin };
}

/** Primeira carga para o botão do álbum: metadados + primeiro bloco. */
export async function loadJournalMeta(): Promise<JournalMeta | null> {
  const a = await access(false);
  return a ? getJournalMeta(a.userId, false) : null;
}

/** Bloco de páginas sob demanda (posições from..to). O servidor recalcula o desbloqueio a cada pedido. */
export async function loadJournalChunk(from: number, to: number, revealAll = false): Promise<BookPage[] | null> {
  const a = await access(revealAll);
  if (!a || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  return getJournalChunk(a.userId, a.revealAll, from, to);
}
