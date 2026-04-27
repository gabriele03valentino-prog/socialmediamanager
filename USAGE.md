# Come si usa SMM Studio

Guida pratica al **flusso di lavoro quotidiano** dell'app, dal primo accesso
all'uso intensivo. Tutto in italiano, niente jargon.

---

## Setup iniziale (una sola volta)

### 1. Login
Accedi con il tuo account Google. Se l'app è in produzione e l'admin ha
abilitato l'allowlist (`AUTH_ALLOWED_EMAILS`), solo le email in lista possono
entrare.

### 2. Profilo artista — `/impostazioni/profilo`
Compila:
- **Stage name** (anche un nome temporaneo, lo cambi dopo dal modulo Brand)
- **Genere** (es. trap, drill, cantautorato, house)
- **Città** (per ranking locale)
- **Bio** breve
- **Obiettivi liberi** in formato testo (es. "10k follower IG entro dicembre")
- **Target views medie TikTok** (M10) — un numero su cui Claude tarerà i
  suggerimenti TikTok

### 3. Connetti i social — `/impostazioni`
Per ogni piattaforma clicca "Connetti". Sequenza tipica:
- **Instagram + Facebook** insieme (Meta Login for Business). Serve account IG
  Business/Creator collegato a una Pagina FB.
- **TikTok** (TikTok for Developers).
- **YouTube** (Google OAuth, riusa il client del login).
- **Spotify** (per le metriche pubbliche). Per gli ascoltatori mensili
  aggiornali a mano: Spotify non li espone via API.

Tutti i token sono cifrati a riposo (AES-256-GCM).

### 4. Primo sync
Da `/impostazioni` clicca "Sync ora" su un account, oppure aspetta il cron
delle 7:00 (Europe/Rome). Il primo sync popola `MetricSnapshot`, `Post`,
`AudienceInsight` se disponibili.

---

## Routine giornaliera consigliata

**🌅 Mattina (8:00)** — Apri la dashboard `/`
- Vedi delta follower 7d/30d
- Vedi il **Feedback** del cron serale di ieri ("Il reel di ieri ha 30% di
  reach in più della media — insisti su questo formato")
- Se hai configurato Resend, lo trovi anche nella tua casella email

**☕ Mattina-pomeriggio** — `/suggerimenti`
- Trovi 7-10 contenuti generati per la settimana
- Ogni card ha: hook, caption, hashtag, CTA, orario consigliato, rationale
- Click "🧠 Neuro-analisi" su un suggerimento per uno score 0-100 +
  breakdown su 6 dimensioni (hook, emozione, novelty, reward, social, curiosity)
  + 3 consigli di miglioramento
- Click "Accetta" → diventa una bozza in `/bozze`

**🎬 Quando produci il contenuto** — `/bozze`
- Apri la bozza, raffina caption e hashtag
- Click "Copia caption + hashtag" e incolla nell'app social
- Carica il media a mano (foto/video)
- Cambia stato a "Pubblicata" quando l'hai postato

**🌙 Sera (19:00)** — il cron analizza i post di oggi
- Confronta engagement vs media tua
- Salva il `DailyFeedback` (titolo + body)
- Se Resend configurato → ti manda email
- Se hai sottoscritto il feed iCal → vedi sul calendario gli item dei prossimi giorni

---

## Modulo Brand — `/brand`

**Da fare una volta** quando lanci l'identità.

### Stage name — `/brand/nome`
1. Inserisci 3-5 parole chiave evocative (es. "notturno, 808, Milano, neon")
2. Eventuali iniziali da mantenere
3. Lingua: italiano / inglese / misto / onomatopeico
4. Genera 12 proposte con rationale + check disponibilità
   - **Spotify**: check automatico via Web API (affidabile)
   - **Instagram + TikTok**: chip "verifica ↗" che apre il profilo in 1 click
     (niente probe HTTP fragile dal datacenter Vercel)
5. "Scegli questo nome" → aggiorna `ArtistProfile.stageName` automaticamente

### Identità visiva — `/brand/identita`
Genera in una call:
- **Palette** 5 colori con hex + ruolo (primary, accent, neutral) + uso ("CTA",
  "sfondo hero", ecc.)
- **Typography** title + body con Google Fonts specifici e rationale
- **Tone of voice** 4 aggettivi + 3 esempi di caption
- **Mood keywords** 6-8 parole visuali
- **Logo brief** + **logo SVG** minimale generato inline da Claude
- **Prompt pronto per [claude.ai/design](https://claude.ai/design)** (Anthropic non
  espone API per Claude Design — il prompt lo incolli a mano sul sito)
- **Prompt Midjourney** strutturato

### Cover release — `/brand/identita` → blocco "Cover in arrivo"
Per ogni singolo/EP/album: titolo + mood + storia → Claude produce
brief + 3 prompt (claude.ai/design, Midjourney, Ideogram).

---

## Modulo Marketing — `/marketing`

### Persona audience — `/marketing/persona`
Genera 2-3 personae archetipiche basate sui tuoi audience insight reali (se
≥100 follower IG/YT) o dal profilo (genre, città, goals). Il recommender
principale le userà come contesto extra.

### Neuro-analisi
Pulsante 🧠 disponibile su ogni suggerimento e su ogni bozza. Score 0-100,
breakdown 6 dimensioni, 3 miglioramenti. Costo: ~€0.01 a chiamata.
Limite: 30/ora.

### Campaign planner — `/marketing/campagna/nuova`
Per una release: data drop, tipo (singolo/EP/album), URL pre-save Spotify
opzionale → Claude genera 5-7 tappe pre-popolate (teaser, snippet, reveal cover,
release day, reaction). Diventano `Suggestion` pronte da accettare.
Limite: 5/giorno.

---

## Modulo Obiettivi — `/obiettivi`

Definisci traguardi misurabili (es. "10k follower IG entro 31/12/2026").

- **Valore di partenza**: preso automaticamente dal tuo ultimo snapshot
- **Progressione**: aggiornata ogni giorno dal cron delle 7:00
- **Trend**: stima lineare basata sugli ultimi 14 punti — ti dice se sei in
  linea con la deadline (✅ on-track, ⚠️ off-track)
- **Auto-status**:
  - `ACHIEVED` quando il valore corrente raggiunge il target
  - `EXPIRED` quando la deadline passa senza successo

Metriche supportate:
- **Follower** — qualunque piattaforma
- **Views medie** — TikTok, YouTube (su ultimi 20 post)
- **Reach medio** — IG, FB
- **Ascoltatori mensili** — Spotify (manuale, no API)

---

## Calendario — `/calendario`

Vista 4 settimane.
- **Desktop**: griglia 7 colonne, ogni cella mostra le bozze schedulate +
  i suggerimenti del giorno con pallino piattaforma
- **Mobile**: lista verticale per giorno, mostra solo giorni con eventi

**Esporta come .ics** col bottone in alto a destra:
- Scarica per importarlo una tantum
- Sottoscrivilo come feed live in Google/Apple Calendar:
  1. Imposta `CALENDAR_FEED_KEY` (32 char random) e `CALENDAR_FEED_OWNER_ID`
     (il tuo `User.id`) in `.env`
  2. URL feed: `…/api/export/calendar?key=<CALENDAR_FEED_KEY>` — il userId è
     hardcoded server-side per evitare IDOR.

---

## Bozze — `/bozze`

Lista filtrabile per stato (TODO / READY / PUBLISHED / ARCHIVED).

**Esporta come CSV** col bottone "⬇ Esporta CSV": utile per condividere il
piano editoriale con il tuo manager o tenere backup esterni. CSV è
RFC 4180-compliant (escape di virgole, virgolette, newline).

---

## Sicurezza & costi

| Cosa | Stato |
|---|---|
| Token social cifrati AES-256-GCM | ✅ |
| Email allowlist (`AUTH_ALLOWED_EMAILS`) | ✅ se impostata |
| Rate limit per-utente sulle 7 route AI | ✅ |
| Budget cap Anthropic | imposta tu su [console.anthropic.com](https://console.anthropic.com/settings/limits) |
| HTTPS automatico Vercel | ✅ |
| DB cifrato a riposo Neon | ✅ |

Costo realistico di esercizio (1-2 generazioni/giorno):
**€0.50 – €3 / mese**, principalmente API Claude.

---

## Cosa fare se qualcosa non funziona

| Sintomo | Cosa controllare |
|---|---|
| Errore "kind: Closed" sul DB | Neon free auto-sospende dopo 5 min idle. Il client Prisma ritenta automaticamente (3 tentativi, backoff 200/600/1800 ms). Aspetta 2-3s e ricarica. |
| "Genera piano" risponde 429 | Hai superato 3/ora. Il messaggio dice quanti secondi mancano. |
| Spotify mostra ascoltatori mensili a 0 | Spotify NON espone questa metrica via API. Aggiornala a mano da `/impostazioni`. |
| TikTok non ha audience demografica | Display API non la espone (richiederebbe Research API, non pratica). Limite voluto, non bug. |
| L'email serale non arriva | Verifica `RESEND_API_KEY` e `EMAIL_FROM` in `.env` (o env Vercel). Senza, il cron scrive comunque il record in DB. |
| Suggerimento accettato non diventa bozza | Refresh la pagina. Se persiste, controlla i log `/api/cron/...` o apri un'issue. |

---

## Comandi utili (dev)

```bash
# Avvia in locale
pnpm dev

# Verifica codice
pnpm typecheck
pnpm test
pnpm build

# Schema DB
pnpm prisma generate           # rigenera il client TS
pnpm prisma db push            # applica schema (dev) — idempotente
pnpm prisma studio             # GUI per ispezionare/editare DB

# Sync manuale di un account
curl -X POST -H "Cookie: <auth-cookie>" http://localhost:3000/api/metrics/sync

# Trigger cron manuale
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/daily-sync

curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/evening-feedback
```
