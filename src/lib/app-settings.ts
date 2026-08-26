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
