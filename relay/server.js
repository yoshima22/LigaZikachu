"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Zika TV — Relay de midia (navegador → YouTube RTMP)
//
// Fluxo:
//   1. O SITE (Next, servidor confiavel) chama POST /sessions com um segredo
//      compartilhado (RELAY_CONTROL_SECRET) e o rtmpUrl completo do YouTube
//      (rtmp://a.rtmp.youtube.com/live2/<streamKey>). O relay responde com
//      { sessionId, ingestToken }. A stream key NUNCA chega ao navegador.
//   2. O NAVEGADOR abre um WebSocket em /ingest?session=<id>&token=<ingestToken>
//      e envia os chunks WebM (MediaRecorder da captura de tela).
//   3. O relay roda ffmpeg lendo o WebM do stdin, transcodifica para H.264/AAC e
//      publica em FLV/RTMP no YouTube.
//   4. O SITE chama DELETE /sessions/<id> (ou o WS fecha) para encerrar; o relay
//      mata o ffmpeg e libera a sessao.
//
// Sem banco, sem estado em disco: tudo em memoria. Uma instancia pequena aguenta
// poucas lives simultaneas (limite por CPU — transcodificar e caro).
// ─────────────────────────────────────────────────────────────────────────────

const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8080);
const CONTROL_SECRET = process.env.RELAY_CONTROL_SECRET || "";
const MAX_SESSIONS = Number(process.env.RELAY_MAX_SESSIONS || 3);
const VIDEO_BITRATE = process.env.RELAY_VIDEO_BITRATE || "2500k";
const AUDIO_BITRATE = process.env.RELAY_AUDIO_BITRATE || "128k";
const PRESET = process.env.RELAY_FFMPEG_PRESET || "veryfast";
// Tempo maximo sem receber chunk antes de derrubar a sessao (ms).
const IDLE_TIMEOUT_MS = Number(process.env.RELAY_IDLE_TIMEOUT_MS || 20000);
// Tempo maximo entre criar a sessao e o navegador conectar (ms).
const CONNECT_GRACE_MS = Number(process.env.RELAY_CONNECT_GRACE_MS || 120000);

if (!CONTROL_SECRET) {
  console.error("[relay] FALTA RELAY_CONTROL_SECRET — recuse iniciar sem segredo.");
  process.exit(1);
}

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} ingestToken
 * @property {string} rtmpUrl
 * @property {import("child_process").ChildProcess|null} ffmpeg
 * @property {import("ws").WebSocket|null} ws
 * @property {number} createdAt
 * @property {number} lastChunkAt
 * @property {NodeJS.Timeout} connectTimer
 */

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 8192) { reject(new Error("body grande demais")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function destroySession(id, reason) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  clearTimeout(s.connectTimer);
  console.log(`[relay] sessao ${id} encerrada (${reason})`);
  if (s.ws) { try { s.ws.close(); } catch { /* noop */ } }
  if (s.ffmpeg) {
    try { s.ffmpeg.stdin.end(); } catch { /* noop */ }
    const ff = s.ffmpeg;
    setTimeout(() => { try { ff.kill("SIGKILL"); } catch { /* noop */ } }, 2000);
  }
}

// ── HTTP control API ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/healthz") {
    return json(res, 200, { ok: true, sessions: sessions.size, maxSessions: MAX_SESSIONS });
  }

  // Todas as rotas de controle exigem o segredo compartilhado.
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!timingSafeEqual(token, CONTROL_SECRET)) {
    return json(res, 401, { error: "nao autorizado" });
  }

  if (req.method === "POST" && url.pathname === "/sessions") {
    if (sessions.size >= MAX_SESSIONS) {
      return json(res, 429, { error: `limite de ${MAX_SESSIONS} lives simultaneas atingido` });
    }
    let body;
    try { body = JSON.parse(await readBody(req) || "{}"); }
    catch { return json(res, 400, { error: "json invalido" }); }
    const rtmpUrl = String(body.rtmpUrl || "");
    if (!/^rtmps?:\/\//.test(rtmpUrl)) {
      return json(res, 400, { error: "rtmpUrl invalido" });
    }
    const id = crypto.randomBytes(9).toString("base64url");
    const ingestToken = crypto.randomBytes(24).toString("base64url");
    const s = {
      id, ingestToken, rtmpUrl, ffmpeg: null, ws: null,
      createdAt: Date.now(), lastChunkAt: 0,
      connectTimer: setTimeout(() => destroySession(id, "navegador nao conectou a tempo"), CONNECT_GRACE_MS),
    };
    sessions.set(id, s);
    console.log(`[relay] sessao ${id} criada`);
    return json(res, 201, { sessionId: id, ingestToken });
  }

  const del = url.pathname.match(/^\/sessions\/([^/]+)$/);
  if (req.method === "DELETE" && del) {
    destroySession(del[1], "encerrada pelo site");
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && del) {
    const s = sessions.get(del[1]);
    if (!s) return json(res, 404, { error: "sessao nao encontrada" });
    return json(res, 200, { id: s.id, live: Boolean(s.ffmpeg), lastChunkAt: s.lastChunkAt });
  }

  return json(res, 404, { error: "rota nao encontrada" });
});

// ── WebSocket de ingest (navegador → relay) ──────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname !== "/ingest") { socket.destroy(); return; }
  const id = url.searchParams.get("session") || "";
  const token = url.searchParams.get("token") || "";
  const s = sessions.get(id);
  if (!s || !timingSafeEqual(token, s.ingestToken)) { socket.destroy(); return; }
  if (s.ffmpeg) { socket.destroy(); return; } // ja tem ingest ativo
  wss.handleUpgrade(req, socket, head, (ws) => startIngest(s, ws));
});

function startIngest(s, ws) {
  clearTimeout(s.connectTimer);
  s.ws = ws;
  s.lastChunkAt = Date.now();

  const args = [
    "-hide_banner", "-loglevel", "warning",
    "-thread_queue_size", "1024",
    "-i", "pipe:0",
    // Video: transcodifica WebM(VP8/VP9) → H.264
    "-c:v", "libx264", "-preset", PRESET, "-tune", "zerolatency",
    "-pix_fmt", "yuv420p", "-profile:v", "main", "-level", "4.1",
    "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
    "-b:v", VIDEO_BITRATE, "-maxrate", VIDEO_BITRATE, "-bufsize", "5000k",
    // Audio: Opus → AAC
    "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-ar", "44100",
    "-f", "flv", s.rtmpUrl,
  ];
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  s.ffmpeg = ff;
  console.log(`[relay] ffmpeg iniciado p/ sessao ${s.id}`);

  ff.stderr.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[ffmpeg ${s.id}] ${line}`);
  });
  ff.on("close", (code) => {
    console.log(`[relay] ffmpeg da sessao ${s.id} saiu (code ${code})`);
    destroySession(s.id, "ffmpeg encerrou");
  });
  ff.stdin.on("error", () => { /* pipe fechado — ignorado */ });

  ws.on("message", (chunk) => {
    s.lastChunkAt = Date.now();
    if (ff.stdin.writable) {
      ff.stdin.write(chunk, (err) => { if (err) { /* backpressure/close */ } });
    }
  });
  ws.on("close", () => {
    console.log(`[relay] ws da sessao ${s.id} fechou`);
    try { ff.stdin.end(); } catch { /* noop */ }
  });
  ws.on("error", () => { try { ff.stdin.end(); } catch { /* noop */ } });
}

// Vigia sessoes ociosas (ffmpeg rodando mas sem chunks) e derruba.
setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) {
    if (s.ffmpeg && s.lastChunkAt && now - s.lastChunkAt > IDLE_TIMEOUT_MS) {
      destroySession(s.id, "ociosa (sem chunks)");
    }
  }
}, 5000).unref();

server.listen(PORT, () => {
  console.log(`[relay] ouvindo em :${PORT} (max ${MAX_SESSIONS} lives, video ${VIDEO_BITRATE})`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[relay] ${sig} — encerrando todas as sessoes`);
    for (const id of [...sessions.keys()]) destroySession(id, "shutdown");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
