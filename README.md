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

#### TikTok — ✅ M3 implementato
1. <https://developers.tiktok.com/apps/> → register app.
2. Aggiungi prodotto **Login Kit for Web**.
3. Richiedi gli scope: `user.info.basic`, `user.info.stats`, `user.info.profile`, `video.list`.
4. Redirect URI:
   - `http://localhost:3000/api/connect/tiktok/callback`
   - `https://<tuo-dominio>/api/connect/tiktok/callback`
5. In modalità Sandbox puoi usare l'app subito con il tuo account; per andare in
   produzione serve review (non necessaria per uso personale).
6. Client Key / Secret → env `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.

#### Spotify — ✅ M4 implementato
1. <https://developer.spotify.com/dashboard> → crea app.
2. Redirect URI: non serve (usiamo Client Credentials, nessun OAuth utente).
3. Client ID/secret → env `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.
4. Connettiti dall'app: Impostazioni → Connetti Spotify → incolla l'URL del
   tuo profilo artista (es. <https://open.spotify.com/artist/…>).
5. Gli **ascoltatori mensili** non sono esposti dall'API pubblica: aggiornali
   a mano in Impostazioni → Spotify (serve un valore a settimana dall'app
   Spotify for Artists → Home → Ascoltatori mensili).

## Demo sempre online — deploy su Vercel

Per non dover lasciare `pnpm dev` acceso sul Mac, deploya l'app su Vercel
(piano Hobby, gratis):

```bash
pnpm vercel-deploy
```

> ⚠️ Non usare `pnpm deploy`: è un comando built-in di pnpm per workspace.
> Usa `pnpm vercel-deploy` o `pnpm run deploy`.

Lo script `scripts/deploy.mjs`:
1. Lancia `vercel link` (interattivo, ti chiede scope e nome progetto)
2. Sincronizza tutte le env del tuo `.env` locale verso Vercel production
3. Esegue `vercel deploy --prod` e ti dà l'URL pubblico

⚠️ **Importante per la sicurezza**: una volta deployato, l'URL è pubblico.
Compila la env `AUTH_ALLOWED_EMAILS` con i tuoi indirizzi email così solo
tu puoi accedere — altrimenti chiunque conoscendo l'URL può consumare il
tuo budget Anthropic.

Dopo il primo deploy, sul dev console di ogni piattaforma OAuth devi
aggiungere il redirect URI con il dominio Vercel (es.
`https://<tuo-progetto>.vercel.app/api/connect/meta/callback`) accanto a
quello `localhost:3000` esistente. Lo script te lo ricorda alla fine.

### Deploy manuale (alternativa)

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
- [x] **M3** — Connettore TikTok (user info + video list, auto-refresh token)
- [x] **M4** — Connettore Spotify (public artist data + input manuale monthly listeners)
- [x] **M5** — Dashboard evoluta (grafici, delta, best post)
- [x] **M6** — Recommender Claude + UI suggestion + profilo artista + accept/reject
- [x] **M7** — Calendario 4-settimane + editor bozze con copy-to-clipboard
- [x] **M8** — Feedback giornaliero Claude + heatmap orari migliori
- [x] **M9** — Rifinitura: Next.js patch CVE, user menu, onboarding guidato
- [x] **M10** — Obiettivo target views medie TikTok nel profilo
- [x] **M11** — Modulo Brand: stage name wizard + identità visiva + cover briefs
- [x] **M12** — Marketing / neuromarketing: persona, neuro-score, campaign planner
- [x] **M13** — Fix post-review: DB retry, editor feedback, env cleanup, handle check onesto
- [x] **M14** — Automazioni: GitHub Action CI + reviewer subagent + Stop hook typecheck
- [x] **M15** — Quality of life: mobile sidebar + empty states + rate limit + goal tracking + email Resend + export CSV/iCal + 48 test vitest + type guards Zod + USAGE.md
- [x] **M16** — Multi-progetto: Project model + CreatorKind enum (ARTIST/YOUTUBER/INFLUENCER/DIVULGATORE/PODCASTER/BRAND), ProjectSwitcher sidebar, cookie HMAC firmato, cap 5 progetti/utente con allowlist override, AI prompts kind-aware, email feedback aggregata, rate-limit composito userId:projectId
- [x] **M17** — Onboarding wizard v2: 4-step `/onboarding` (Kind → Identità → Social → Genera), card grid pickable, auto-generate primo piano, time-to-first-suggestion <2min
- [x] **M18** — Trend Library: model `Trend` con kind/status/platforms/expiresAt, CRUD API, Claude `suggestTrends`, recommender include trend ACTIVE, cron auto-EXPIRED, pagina `/trend` con tabs

## Onboarding wizard (M17)

Nuovo utente (0 progetti) viene rediretto a `/onboarding` (full-screen, niente sidebar):

1. **Tipo creator** — grid 2×3 con 6 KindCard colorate (icon + tagline + esempi format).
2. **Identità** — form con `displayName` (obbligatorio), `niche`, `city`, `bio`. Crea Project via `POST /api/projects` + activate cookie.
3. **Connect social** — lista IG+FB / TikTok / YouTube / Spotify con stato connect; Skip permesso. OAuth start/callback supportano `?next=URL` firmato HMAC per tornare allo step 4.
4. **Genera primo piano** — auto `POST /api/suggestions/generate` al mount, loading state, redirect a `/suggerimenti` su success.

Skip wizard → `/progetti?create=1` (form classico CreateProjectModal). Wizard sempre accessibile da `/onboarding`.

## Multi-progetto (M16)

Un account utente può gestire fino a **5 progetti** indipendenti (cap rimuovibile via `EMAIL_ALLOWLIST`). Ogni progetto è di tipo **kind**:

- `ARTIST` — musicista/producer (linee guida music-first attive)
- `YOUTUBER` — long-form video
- `INFLUENCER` — lifestyle/fashion
- `DIVULGATORE` — educator
- `PODCASTER` — podcast audio
- `BRAND` — azienda

Il progetto attivo è memorizzato in cookie HTTP-only firmato HMAC (`active_project_id`).
Switch dal dropdown in cima alla sidebar. AI prompts adattano i suggerimenti
al kind del progetto (KIND-SPECIFIC GUIDELINES sotto cache control).

Cron giornalieri iterano `Project`. L'email feedback aggrega tutti i progetti
attivi (toggle per-progetto via `emailFeedbackEnabled`) in 1 email/giorno per utente.

## Automazioni di qualità

- **GitHub Action** (`.github/workflows/ci.yml`): a ogni push o PR lancia
  `pnpm typecheck` + `pnpm build`. Niente di rotto sfugge.
- **Reviewer subagent** (`.claude/agents/reviewer.md`): quando vuoi una review
  veloce basta dire a Claude Code "usa il reviewer" o "rivedi il codice".
  L'agente conosce già la struttura dell'app.
- **Stop hook typecheck** (`.claude/settings.json` + `.claude/hooks/`):
  dopo ogni turno di Claude, in background parte un `pnpm typecheck`.
  Se qualcosa è rotto, Claude se ne accorge subito e si auto-corregge.

## Modulo Marketing & TRIBE v2

Il neuro-score e il piano campagna usano un system prompt Claude che codifica i
**segnali brain-predictive di TRIBE v2** (Meta AI, CC-BY-NC-4.0):
V1/V4 (contrasto, movimento), STS (audio-linguistico), nucleus accumbens
(reward prediction), amigdala/insula (emotional valence), mPFC (social salience),
DA system (novelty/prediction error).

**Non** chiamiamo direttamente il modello TRIBE v2:
- I pesi sono su HuggingFace (`facebook/tribev2`) ma richiedono GPU per inferenza
- L'output (20k vertici corticali fsaverage5) andrebbe post-processato per essere
  utile su contenuti pre-produzione (bozze, caption, hook)
- La licenza CC-BY-NC-4.0 limita usi commerciali

Claude produce uno score 0-100 + breakdown 6 dimensioni + 2-5 miglioramenti
specifici in 5-10 secondi a costo trascurabile. Se in futuro vorrai integrare
il modello reale per testare video finiti, l'integrazione sarebbe un
microservizio Python separato — documentato come possibile estensione ma non
incluso nell'app.

## Test end-to-end

```bash
pnpm typecheck         # type check
pnpm test              # 48 unit test (vitest) — utils, rate-limit, export, goals, types, email
pnpm test:watch        # modalità watch durante lo sviluppo
pnpm test:coverage     # report coverage lcov
pnpm build             # build di produzione

# sync manuale (da autenticato)
curl -X POST http://localhost:3000/api/metrics/sync

# trigger cron manuale
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/daily-sync
```

## Notifiche email (opzionali)

Imposta `RESEND_API_KEY` ed `EMAIL_FROM` in `.env` per ricevere il feedback
serale via email. Senza queste env vars il cron continua a scrivere il record
`DailyFeedback` in DB (visibile dalla dashboard), ma non manda nessuna email.
Free tier Resend = 3.000 mail/mese, abbondante.

## Rate limit & budget cap

Le route che chiamano Anthropic (recommender, brand, neuro-score, campaign,
persona) hanno un rate limit in-memory per utente:

| Route | Limite |
|---|---|
| `/api/suggestions/generate` | 3/ora |
| `/api/brand/stage-names` | 5/giorno |
| `/api/brand/generate-identity` | 5/giorno |
| `/api/brand/cover-brief` | 10/giorno |
| `/api/marketing/score` | 30/ora |
| `/api/marketing/persona` | 5/giorno |
| `/api/marketing/campaign` | 5/giorno |

Il **paracadute economico vero** è il **budget cap su
[Anthropic Console](https://console.anthropic.com/settings/limits)** — imposta
$5/mese hard stop. Il rate limit serve solo a evitare spese accidentali da
loop client/bug.

## Calendario sottoscrivibile

L'endpoint `/api/export/calendar` produce un `.ics` (RFC 5545) con bozze
schedulate + suggerimenti pendenti. Aprilo dal browser per scaricarlo, oppure
sottoscrivilo come feed live:

```
https://<tua-app>.vercel.app/api/export/calendar?key=<CALENDAR_FEED_KEY>
```

Imposta entrambe le env vars per abilitare il feed senza login:
- `CALENDAR_FEED_KEY` — 32 char random
- `CALENDAR_FEED_OWNER_ID` — il `User.id` autorizzato (hardcoded server-side
  per evitare IDOR; il client non può indicare un userId arbitrario)

Funziona su Google Calendar, Apple Calendar, Outlook. Confronto stringhe
in tempo costante per evitare timing attack sul token.

## Limiti noti (trasparenza)

- **Spotify**: ascoltatori mensili e stream NON disponibili via API → update manuale.
- **TikTok**: nessuna demografica audience via Display API.
- **Instagram**: demografica solo con ≥100 follower.
- **Pubblicazione automatica**: volutamente disabilitata. Copia/incolla tu le
  bozze sui social.
