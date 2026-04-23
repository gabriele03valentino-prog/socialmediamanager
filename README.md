# SMM Studio

Social media manager automatizzato per artisti e produttori musicali **italiani**.
Ti dice **cosa**, **come** e **quando** postare su Instagram, Facebook, TikTok,
YouTube e Spotify, usando le metriche in live dei tuoi profili.

> **Modalità**: solo suggerimenti + bozze. Pubblichi tu manualmente — niente
> approvazioni Meta/TikTok in produzione, nessun rischio shadowban da automazione.

## Stack

- **Next.js 15** (App Router, TypeScript) — UI + API + cron in un solo repo
- **Postgres** via **Prisma** (consigliato: [Neon free](https://neon.tech))
- **Auth.js v5** con provider Google per il login dell'app
- **Anthropic Claude** (`claude-sonnet-4-6`) con tool-use strutturato e prompt caching
- **Tailwind CSS** + lucide-react
- Deploy gratuito su **Vercel Hobby** (include 2 cron jobs)

## Struttura del progetto

```
prisma/schema.prisma          # modelli DB
lib/
  db.ts                       # Prisma client
  crypto.ts                   # AES-256-GCM per i token
  utils.ts
  sync.ts                     # orchestra il sync di un account
  platforms/
    adapter.ts                # interfaccia comune
    meta.ts                   # IG + FB
    tiktok.ts
    youtube.ts
    spotify.ts
    index.ts                  # registry
  ai/
    prompts.ts                # system prompt cachato
    context-builder.ts        # costruisce il contesto da DB
    recommender.ts            # chiamata Claude + tool-use
app/
  (app)/                      # area autenticata
    page.tsx                  # Dashboard
    calendario/page.tsx
    suggerimenti/page.tsx
    bozze/page.tsx
    analytics/[platform]/page.tsx
    impostazioni/page.tsx
  login/page.tsx
  api/
    auth/[...nextauth]/       # handler NextAuth
    cron/
      daily-sync/             # 07:00 IT
      evening-feedback/       # 19:00 IT
    metrics/sync/             # POST per sync manuale
    suggestions/[id]/accept   # suggestion → draft
    suggestions/[id]/reject
    drafts/[id]               # PATCH + DELETE
    connect/[platform]/start  # OAuth social (stub M0)
components/
  SidebarNav.tsx
  KpiCard.tsx
  ConnectAccountButton.tsx
  SuggestionCard.tsx
middleware.ts                 # redirect su /login
auth.ts                       # config Auth.js
vercel.json                   # schedule cron
```

## Setup locale (macOS, 1 comando)

```bash
pnpm install
pnpm configure        # oppure: node scripts/setup.mjs
```

> ⚠️ Non usare `pnpm setup`: è un comando built-in di pnpm (serve a pnpm
> stesso per configurare il PATH). Usa `pnpm configure` o `pnpm run setup`.

Lo script `scripts/setup.mjs`:
1. Auto-genera i secret locali (`AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`)
2. Apre in Chrome gli URL di Neon, Anthropic, Google Cloud e Meta uno alla volta
3. Ti chiede ogni valore da incollare (con default dai valori esistenti se ri-esegui)
4. Scrive `.env` pulito
5. Applica lo schema a Postgres (`pnpm prisma db push`)
6. Avvia `pnpm dev` e apre `http://localhost:3000` in Chrome

Puoi ri-lanciare `pnpm setup` in qualsiasi momento per cambiare un valore.

### Setup manuale (se preferisci)

```bash
cp .env.example .env
# editta .env con: DATABASE_URL, AUTH_SECRET, TOKEN_ENCRYPTION_KEY,
# CRON_SECRET, AUTH_GOOGLE_ID/SECRET, ANTHROPIC_API_KEY (+ META_*)
pnpm prisma db push
pnpm dev
```

### Setup delle app OAuth social

Tutte gratis. Fai una app alla volta secondo quale connettore vuoi usare prima.

#### Google (login app + YouTube) — ✅ M2 implementato
1. <https://console.cloud.google.com> → nuovo progetto.
2. APIs & Services → Credentials → Create OAuth client (Web).
3. Authorized redirect URIs (aggiungili **entrambi** allo stesso client):
   - `http://localhost:3000/api/auth/callback/google` (login app)
   - `http://localhost:3000/api/connect/youtube/callback` (connettore YouTube)
   - in produzione aggiungi le versioni `https://<dominio>/...`
4. Client ID / Secret → env `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   (li riusiamo anche per il connettore YouTube).
5. Abilita **YouTube Data API v3** (<https://console.cloud.google.com/apis/library/youtube.googleapis.com>)
   e **YouTube Analytics API** (<https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com>).
6. In Impostazioni → Connetti YouTube: flusso OAuth separato con scope
   `youtube.readonly` + `yt-analytics.readonly`, refresh token salvato cifrato,
   access token auto-rinnovato a ogni sync.

#### Meta (Instagram + Facebook) — ✅ M1 implementato
1. <https://developers.facebook.com/apps/create/> → tipo **Business**.
2. Aggiungi prodotto **Instagram** (Instagram Graph API, non Basic Display) +
   **Facebook Login for Business**.
3. In **Facebook Login for Business → Settings** imposta Valid OAuth Redirect URIs:
   - `http://localhost:3000/api/connect/meta/callback`
   - `https://<tuo-dominio>/api/connect/meta/callback`
4. In dev mode aggiungiti come tester (App Roles → Roles → Add People) — così puoi
   usare l'app senza review.
5. Il tuo IG deve essere **Business** o **Creator** e collegato a una Pagina FB
   (Impostazioni IG → Account → Passa ad account professionale).
6. Copia App ID / App Secret in `.env` come `META_CLIENT_ID` / `META_CLIENT_SECRET`.
7. Nel tab **Impostazioni** dell'app clicca "Connetti" su Instagram o Facebook: il
   flusso Meta crea un SocialAccount FACEBOOK per ogni Pagina e un INSTAGRAM per
   ogni Pagina che ha un IG Business collegato.

#### TikTok
1. <https://developers.tiktok.com> → registra app.
2. Aggiungi prodotto **Login Kit** con scopes `user.info.basic`, `user.info.stats`,
   `video.list`.
3. Redirect URI: `https://<dominio>/api/connect/tiktok/callback`.
4. Client key/secret → env.

#### Spotify
1. <https://developer.spotify.com/dashboard> → crea app.
2. Redirect URI: `https://<dominio>/api/connect/spotify/callback`.
3. Client ID/secret → env.

## Deploy su Vercel

```bash
# una tantum
vercel link
# imposta le env (oppure via UI Vercel)
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
# ... (tutte le variabili sopra)

vercel deploy --prod
```

I cron vengono letti da `vercel.json` in automatico (`/api/cron/daily-sync` e
`/api/cron/evening-feedback`).

⚠️ **Vercel Hobby limita il tempo di esecuzione a 60 secondi**. Se hai molti
account social, `daily-sync` potrebbe non bastare: in quel caso lo spezzi in
più cron (`/api/cron/sync-ig`, `/api/cron/sync-yt`, ecc.) o passi a Pro.

## Costi

| Voce | Costo mensile |
|---|---|
| Vercel Hobby | €0 |
| Neon Postgres free | €0 |
| OAuth app Meta/TikTok/Google/Spotify | €0 |
| Anthropic API (Claude sonnet-4-6, ~30 gen/mese con caching) | €1-3 |
| **Totale** | **~€1-3/mese** |

## Milestone

Questa release è **M0** (scaffolding completo e funzionante end-to-end con
stub nei connettori social).

- [x] **M0** — Scaffold Next.js + Prisma + Auth + UI + recommender Claude + cron
- [x] **M1** — Connettore Meta (IG + FB) full (OAuth + sync metriche/post/audience)
- [x] **M2** — Connettore YouTube (Data API v3 + Analytics API, auto-refresh token)
- [ ] **M3** — Connettore TikTok
- [ ] **M4** — Connettore Spotify + input manuale monthly listeners
- [ ] **M5** — Dashboard evoluta (grafici, delta, best post)
- [ ] **M6** — Recommender Claude + UI suggestion (base già in M0)
- [ ] **M7** — Calendario FullCalendar drag&drop + editor bozze
- [ ] **M8** — Feedback serale + email (Resend) + heatmap best time
- [ ] **M9** — Rifinitura, export bozze, notifiche push

## Test end-to-end

```bash
pnpm typecheck
pnpm build

# sync manuale (da autenticato)
curl -X POST http://localhost:3000/api/metrics/sync

# trigger cron manuale
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/daily-sync
```

## Limiti noti (trasparenza)

- **Spotify**: ascoltatori mensili e stream NON disponibili via API → update manuale.
- **TikTok**: nessuna demografica audience via Display API.
- **Instagram**: demografica solo con ≥100 follower.
- **Pubblicazione automatica**: volutamente disabilitata. Copia/incolla tu le
  bozze sui social.
