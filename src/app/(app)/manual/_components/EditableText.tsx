"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { saveManualText } from "../actions";

interface Props {
  textKey: string;
  value: string;
  className?: string;
  /** Renderização do texto (padrão: <p>) */
  as?: "p" | "span";
}

export function EditableText({ textKey, value, className, as: Tag = "p" }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(value);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const cancel = () => {
    setText(saved);
    setEditing(false);
  };

  const save = () => {
    startTransition(async () => {
      await saveManualText({ key: textKey, value: text });
      setSaved(text);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(3, text.split("\n").length + 1)}
          className="w-full rounded-lg border border-[#FFCB05]/40 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/70 resize-y"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-1 rounded-lg bg-[#FFCB05] px-2.5 py-1 text-[11px] font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60"
          >
            <Check size={11} /> {isPending ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={cancel}
            disabled={isPending}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
          >
            <X size={11} /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/editable relative">
      <Tag className={className}>{saved}</Tag>
      <button
        onClick={startEdit}
        title="Editar texto"
        className="absolute -right-1 -top-1 hidden rounded-md bg-slate-800 p-1 text-slate-500 hover:text-[#FFCB05] group-hover/editable:flex"
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}
