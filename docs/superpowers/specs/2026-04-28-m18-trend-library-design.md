# M18 — Trend Library Design

**Date:** 2026-04-28 (autonomous)
**Status:** Approved (user "vai in modalità auto")
**Scope:** Cattura trend (sound/format/topic) noti e li inietta nel context Claude per suggerimenti più tempestivi. Manual CRUD + Claude-suggested trends, no API esterne (TikTok Research API non disponibile su Hobby tier).

## Razionale

Tip from M16 brainstorm: "Trend ingestion — fetch trending sounds TikTok+Reels, suggerimenti agganciati a trend caldi". Realtà tecnica:
- TikTok Research API: solo university/whitelist, non Hobby
- Instagram: no API pubblica per trending
- YouTube Trending: API disponibile ma per video pop generici, non format/sound

**Soluzione pragmatica:** Trend Library — DB di trend noti (sound/format/topic) curato manualmente + Claude per proporre nuovi trend basati su sua conoscenza training. Recommender legge trend `active` e li integra nel context.

## Modello dati

```prisma
enum TrendKind {
  SOUND       // audio specifico TikTok/Reels
  FORMAT      // pattern visivo (POV, GRWM, "tell me without telling me")
  TOPIC       // hot topic/discorso del momento
  HASHTAG     // hashtag in tendenza
  CHALLENGE   // sfida virale
}

enum TrendStatus {
  ACTIVE      // in voga ora
  WARMING     // emergente
  EXPIRED     // passato
}

model Trend {
  id           String      @id @default(cuid())
  projectId    String
  kind         TrendKind
  name         String      // titolo breve
  description  String?     @db.Text
  sourceUrl    String?     // link esempio (TikTok video, articolo)
  platforms    Platform[]  // dove è in voga
  status       TrendStatus @default(ACTIVE)
  notedAt      DateTime    @default(now())
  expiresAt    DateTime?   // dopo cui auto-EXPIRED via cron daily
  generatedBy  String?     // "manual" | "claude-sonnet-4-6"

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
}
```

Aggiunta a `model Project`: `trends Trend[]`.

## API

```
GET    /api/trends                 → lista trends del project attivo (filtrabili per status/kind)
POST   /api/trends                 → crea (manual)
PATCH  /api/trends/[id]            → update status/expiresAt
DELETE /api/trends/[id]            → elimina
POST   /api/trends/suggest         → Claude propone N trend (rate-limited 3/giorno)
```

Tutte usano `withProjectRoute`. `suggest` accetta opzionale `kind` per filtrare proposte.

## Helper AI

`lib/ai/trends.ts::suggestTrends(project, kind?, count = 5)`:
- System prompt cachato che istruisce Claude a proporre trend italiani caldi per quel kind
- Tool `propose_trends` con array di {kind, name, description, platforms[], expiresInDays}
- Output salvato come Trend con `generatedBy: "claude-sonnet-4-6"` e `status: WARMING`
- User poi conferma → ACTIVE, o lascia EXPIRED

Prompt include `today` per ancorare temporalità ("trend di {today}").

## Integration con recommender

`lib/ai/context-builder.ts` aggiunge `trends: { active: [...], warming: [...] }` al payload:

```ts
trends: {
  active: project.trends
    .filter(t => t.status === "ACTIVE")
    .slice(0, 10)
    .map(t => ({ kind: t.kind, name: t.name, platforms: t.platforms }))
}
```

System prompt aggiornato con sezione che dice "Se nel context ci sono `trends.active`, almeno 1-2 suggerimenti settimanali devono agganciarli."

## Cron auto-expire

Estensione `app/api/cron/daily-sync/route.ts`:
- Dopo sync, esegue `prisma.trend.updateMany({ where: { status: "ACTIVE", expiresAt: { lt: now } }, data: { status: "EXPIRED" } })`
- Stesso per WARMING → ACTIVE non automatico (richiede approvazione user via PATCH)

## UI

Pagina `/trend`:
- Tab "Attivi" (default), "Emergenti", "Scaduti"
- Lista cards (kind badge, name, description, platforms, expiresAt countdown)
- Bottoni "Imposta ACTIVE", "Scaduto", "Elimina"
- Bottone hero "Suggerisci 5 trend con Claude" (rate-limited)
- Nuovo trend via modal o inline form

`SidebarNav` aggiunge voce "Trend" (icon `TrendingUp` lucide).

## Testing

```
lib/ai/trends.test.ts            # mock anthropic, verifica parsing tool output
app/api/trends/route.test.ts     # CRUD + suggest 401/400/201
```

Target: +6 test (~119 totali).

## Migration

Single migration `m18_trends`. Big bang OK (dev only).

## Out of scope

- Auto-expire WARMING dopo N giorni se non confermato (richiede UX cura)
- Trend cross-project (universali per kind)
- Bulk import CSV
- Webhook notifiche trend caldi (no signal source pubblico)
