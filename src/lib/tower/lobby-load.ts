export async function settleTowerLobbyLoad<T>(load: () => Promise<T>, timeoutMs = 25_000): Promise<
  { ok: true; value: T } | { ok: false; error: string }
> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(load).then(
        (value) => ({ ok: true as const, value }),
        () => ({ ok: false as const, error: "Não foi possível carregar o lobby. Tente novamente." }),
      ),
      new Promise<{ ok: false; error: string }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, error: "O lobby demorou demais para responder. Tente novamente." }), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
