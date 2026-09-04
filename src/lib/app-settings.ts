import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

export const GLOBAL_NOTICE_KEY = "global_notice";
export const GLOBAL_NOTICE_TAG = "global-notice";

type GlobalNoticeValue = {
  message?: string;
  updatedAt?: string;
};

export const getGlobalNotice = unstable_cache(
  async () => {
    try {
      const setting = await prisma.appSetting.findUnique({
        where: { key: GLOBAL_NOTICE_KEY },
        select: { value: true, updatedAt: true },
      });
      const value = (setting?.value ?? {}) as GlobalNoticeValue;
      const message = typeof value.message === "string" ? value.message.trim() : "";
      return {
        message,
        updatedAt: setting?.updatedAt ?? null,
      };
    } catch {
      return { message: "", updatedAt: null };
    }
  },
  [GLOBAL_NOTICE_KEY],
  { revalidate: 600, tags: [GLOBAL_NOTICE_TAG] },
);

export function revalidateGlobalNotice() {
  revalidateTag(GLOBAL_NOTICE_TAG);
}

// ── Meta pública de custos do servidor ──────────────────────────────────────
export const SERVER_COST_GOAL_KEY = "server_cost_goal";
export const SERVER_COST_GOAL_TAG = "server-cost-goal";

export type ServerCostGoalValue = {
  title: string;
  percentage: number;
  active: boolean;
  updatedAt?: string;
};

const EMPTY_SERVER_COST_GOAL: ServerCostGoalValue = {
  title: "Meta de Custos do Server",
  percentage: 0,
  active: false,
};

export const getServerCostGoal = unstable_cache(
  async (): Promise<ServerCostGoalValue> => {
    try {
      const setting = await prisma.appSetting.findUnique({
        where: { key: SERVER_COST_GOAL_KEY },
        select: { value: true },
      });
      const value = (setting?.value ?? {}) as Partial<ServerCostGoalValue>;
      const percentage = Number(value.percentage);
      return {
        title: typeof value.title === "string" && value.title.trim()
          ? value.title.trim().slice(0, 80)
          : EMPTY_SERVER_COST_GOAL.title,
        percentage: Number.isFinite(percentage)
          ? Math.min(100, Math.max(0, Math.round(percentage)))
          : 0,
        active: Boolean(value.active),
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
      };
    } catch {
      return EMPTY_SERVER_COST_GOAL;
    }
  },
  [SERVER_COST_GOAL_KEY],
  { revalidate: 600, tags: [SERVER_COST_GOAL_TAG] },
);

export function revalidateServerCostGoal() {
  revalidateTag(SERVER_COST_GOAL_TAG);
}

// ── Aviso com confirmação (modal único que o jogador precisa ler e fechar) ──────
export const ACK_NOTICE_KEY = "ack_notice";
export const ACK_NOTICE_TAG = "ack-notice";

export type AckNoticeValue = {
  version: number;
  title: string;
  content: string;
  buttonText: string;
  active: boolean;
  updatedAt?: string;
};

const EMPTY_ACK: AckNoticeValue = { version: 0, title: "", content: "", buttonText: "Entendi", active: false };

export const getAckNotice = unstable_cache(
  async (): Promise<AckNoticeValue> => {
    try {
      const setting = await prisma.appSetting.findUnique({ where: { key: ACK_NOTICE_KEY }, select: { value: true } });
      const v = (setting?.value ?? {}) as Partial<AckNoticeValue>;
      return {
        version: typeof v.version === "number" ? v.version : 0,
        title: typeof v.title === "string" ? v.title : "",
        content: typeof v.content === "string" ? v.content : "",
        buttonText: typeof v.buttonText === "string" && v.buttonText.trim() ? v.buttonText : "Entendi",
        active: Boolean(v.active),
        updatedAt: v.updatedAt,
      };
    } catch {
      return EMPTY_ACK;
    }
  },
  [ACK_NOTICE_KEY],
  { revalidate: 600, tags: [ACK_NOTICE_TAG] },
);

export function revalidateAckNotice() {
  revalidateTag(ACK_NOTICE_TAG);
}

// ── Patch notes (até 3 páginas curtas, exibidas no dashboard) ─────────────────
export const PATCH_NOTES_KEY = "patch_notes";
export const PATCH_NOTES_TAG = "patch-notes";

export type PatchNote = { title: string; content: string };
export type PatchNotesValue = { notes: PatchNote[]; updatedAt?: string };

export const getPatchNotes = unstable_cache(
  async (): Promise<PatchNotesValue> => {
    try {
      const setting = await prisma.appSetting.findUnique({ where: { key: PATCH_NOTES_KEY }, select: { value: true } });
      const v = (setting?.value ?? {}) as Partial<PatchNotesValue>;
      const notes = Array.isArray(v.notes)
        ? v.notes
            .filter((n): n is PatchNote => !!n && typeof (n as PatchNote).content === "string" && (n as PatchNote).content.trim().length > 0)
            .slice(0, 3)
            .map((n) => ({ title: typeof n.title === "string" ? n.title : "", content: String(n.content) }))
        : [];
      return { notes, updatedAt: v.updatedAt };
    } catch {
      return { notes: [] };
    }
  },
  [PATCH_NOTES_KEY],
  { revalidate: 600, tags: [PATCH_NOTES_TAG] },
);

export function revalidatePatchNotes() {
  revalidateTag(PATCH_NOTES_TAG);
}
