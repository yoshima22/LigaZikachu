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
