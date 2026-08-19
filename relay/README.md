# Zika TV — Relay de mídia (navegador → YouTube)

Serviço pequeno que recebe a captura de tela do navegador (WebM via WebSocket) e
publica no YouTube por RTMP usando `ffmpeg`. Roda **de graça** numa VM do
**Oracle Cloud Always Free**. A stream key do YouTube fica só entre o **site** e o
**relay** — nunca chega ao navegador.

```
Navegador (getDisplayMedia + MediaRecorder)
      │  WebSocket (WebM)
      ▼
  Relay (este serviço) ── ffmpeg ──► rtmp://a.rtmp.youtube.com/live2/<streamKey>
      ▲
      │  HTTP de controle (Bearer RELAY_CONTROL_SECRET)
   Site (Next server actions)
```

## 1. Criar a VM gratuita na Oracle

1. Conta em <https://www.oracle.com/cloud/free/> (a camada **Always Free** é permanente).
2. **Compute → Instances → Create Instance.**
   - Shape: **Ampere A1 (ARM), Always Free** — pode dar 1 OCPU / 6 GB (ou até 4/24 dentro da cota gratuita).
   - Imagem: **Ubuntu 22.04**.
   - Salve a chave SSH.
3. **Rede (liberar a porta do relay):**
   - Na VCN → **Security List** da subnet, adicione **Ingress**: origem `0.0.0.0/0`, TCP, porta **8080** (ou a que você usar).
   - No Ubuntu: `sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT` e persista (`sudo netfilter-persistent save`) — a imagem Oracle vem com iptables restritivo.
4. Anote o **IP público** da VM.

> **HTTPS obrigatório:** o site é HTTPS, então o navegador só abre WebSocket para
> `wss://` (não `ws://`). Ponha um domínio/subdomínio apontando para o IP e um
> proxy TLS na frente (ver passo 4). Sem isso, o navegador bloqueia a conexão.

## 2. Instalar e rodar

SSH na VM e:

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg nodejs npm git
git clone <URL-do-repo> zika && cd zika/relay
npm install --omit=dev
cp .env.example .env && nano .env   # defina RELAY_CONTROL_SECRET (openssl rand -base64 32)
```

Rodar como serviço (systemd), para subir sozinho no boot:

```bash
sudo tee /etc/systemd/system/zika-relay.service >/dev/null <<'UNIT'
[Unit]
Description=Zika TV relay
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/zika/relay
EnvironmentFile=/home/ubuntu/zika/relay/.env
ExecStart=/usr/bin/node server.js
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable --now zika-relay
sudo systemctl status zika-relay --no-pager
```

Teste local: `curl localhost:8080/healthz` → `{"ok":true,...}`.

> Alternativa Docker: `docker build -t zika-relay . && docker run -d --env-file .env -p 8080:8080 --restart=always zika-relay`.

## 3. YouTube (stream key)

- Use o canal da Zika com **transmissão ao vivo habilitada** (a 1ª vez o YouTube
  pede verificação e libera em ~24 h).
- **Fase de teste (sem API):** em YouTube Studio → *Criar → Transmitir ao vivo →
  Chave de transmissão*, copie a **stream key** e a URL `rtmp://a.rtmp.youtube.com/live2`.
  Marque a live como **Não listada**. Essa chave persistente serve para validar o
  pipeline com uma live por vez.
- **Fase final (pelo site):** o site cria o broadcast e obtém uma stream key nova
  por live via **YouTube Data API v3** (permite várias lives e gerência completa
  pelo site). Precisa do OAuth (`YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN`).

## 4. TLS (wss://) na frente do relay

Coloque **Caddy** (mais simples) para terminar HTTPS e fazer proxy para o relay:

```bash
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
relay.SEU-DOMINIO.com {
  reverse_proxy localhost:8080
}
CADDY
sudo systemctl restart caddy
```

Aponte `relay.SEU-DOMINIO.com` (A record) para o IP da VM. O Caddy emite o
certificado sozinho. A partir daí o site usa `https://relay.SEU-DOMINIO.com` para
controle e `wss://relay.SEU-DOMINIO.com/ingest` para o navegador.

## 5. Variáveis que o SITE vai precisar (no .env da Vercel)

```
ZIKA_RELAY_URL=https://relay.SEU-DOMINIO.com
ZIKA_RELAY_CONTROL_SECRET=<o mesmo RELAY_CONTROL_SECRET da VM>
# Fase de teste (chave persistente); na fase final vem da YouTube Data API:
YOUTUBE_RTMP_BASE=rtmp://a.rtmp.youtube.com/live2
YOUTUBE_TEST_STREAM_KEY=<sua stream key de teste>
```

## Contrato HTTP do relay (usado pelo site)

- `POST /sessions` — header `Authorization: Bearer <secret>`, body `{ "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2/<key>" }` → `201 { sessionId, ingestToken }`.
- `DELETE /sessions/:id` — encerra e mata o ffmpeg.
- `GET /sessions/:id` — `{ live, lastChunkAt }`.
- `GET /healthz` — status e nº de sessões.
- WebSocket `wss://.../ingest?session=<id>&token=<ingestToken>` — envie chunks WebM binários.

## Limites e cuidados

- **CPU manda:** transcodificar é caro. Uma A1 Always Free segura ~1–3 lives 720p
  simultâneas. Passou disso, sobe latência/derruba — ajuste `RELAY_MAX_SESSIONS`.
- **Free tier da Oracle** pode recuperar instância muito ociosa; mantenha uso.
- Sem persistência: reiniciou o relay, as lives em andamento caem (o site precisa
  recriar a sessão).
