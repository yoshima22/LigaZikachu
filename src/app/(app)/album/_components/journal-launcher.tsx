"use client";

import { useEffect, useState, useTransition } from "react";
import { BookMarked, Loader2, X } from "lucide-react";
import { loadJournalPages } from "@/app/(app)/journal/actions";
import { JournalBook, type BookPage } from "@/app/(app)/journal/_components/journal-book";

/** Botão (admin) que puxa o Journal para a tela e o abre com animação. */
export function JournalLauncher() {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<BookPage[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function launch() {
    setOpen(true);
    if (pages) return;
    setError(false);
    start(async () => {
      try {
        const result = await loadJournalPages();
        if (result) setPages(result);
        else setError(true);
      } catch {
        setError(true);
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={launch}
        className="flex items-center gap-1.5 rounded-lg border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-2 text-xs font-semibold text-[#FFCB05] transition hover:bg-[#FFCB05]/20"
      >
        <BookMarked size={14} /> Journal
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Journal"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-3 backdrop-blur-sm md:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar o Journal"
            className="fixed right-3 top-3 z-[110] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-slate-200 transition hover:border-[#FFCB05]/60 hover:text-[#FFCB05]"
          >
            <X size={18} />
          </button>
          <div className="mx-auto max-w-5xl pt-10">
            {pages ? (
              <JournalBook pages={pages} autoOpen />
            ) : (
              <p className="flex items-center justify-center gap-2 py-24 text-sm text-slate-300">
                {error ? "Não foi possível carregar o Journal." : (<><Loader2 size={16} className={pending ? "animate-spin" : ""} /> Buscando o livro…</>)}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
