# M19 — Post-mortem auto Design

**Date:** 2026-04-28 (autonomous)
**Status:** Approved (user "vai in modalità auto")
**Scope:** Confronta perf di ogni post 48h dopo pubblicazione vs baseline (ultimi 30 giorni stessa platform+contentType del project). Salva insight in DB, alimenta context Claude per imparare cosa funziona davvero.

## Razionale

Currently Claude propone, user pubblica, ma niente loop di apprendimento basato su esiti reali. M19 introduce post-mortem: 48h dopo ogni post sincronizzato, sistema misura performance vs media e tagga risultato (OUTLIER_HIGH / NORMAL / OUTLIER_LOW). Insight aggregati nel context settimanale = Claude sa "Reel snippet + lyrics caption va sopra la media" e doppia.

## Schema

```prisma
enum PostOutcome {
  OUTLIER_HIGH    // perf >= 2× baseline
  ABOVE           // perf > baseline
  NORMAL          // entro ±20% baseline
  BELOW           // perf < baseline
  OUTLIER_LOW     // perf <= 0.5× baseline
}

model PostMortem {
  id           String      @id @default(cuid())
  postId       String      @unique
  projectId    String
  platform     Platform
  contentType  String      // mediaType: "REEL" | "CAROUSEL" | "VIDEO" | ...
  outcome     PostOutcome
  metric      String      // "engagement" | "views" | "reach" — quale metrica ha guidato il giudizio
  postValue   Int         // valore della metrica per questo post
  baselineMed Int         // mediana della metrica sull'ultima baseline
  ratio       Float       // postValue / baselineMed (0..N)
  caption     String?     @db.Text  // snippet caption per context AI
  hashtags    String[]
  insightTags String[]    // tag derivati: "lyric", "snippet", "BTS", ecc — derivati semplicistici dal caption
  createdAt   DateTime    @default(now())

  post    Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([projectId, outcome])
}
```

Aggiunte:
- `Project.postMortems Post Mortem[]`
- `Post.postMortem PostMortem?`

## Algoritmo

`lib/post-mortem.ts::evaluatePostMortem(post, baseline)`:
1. Sceglie metrica primaria per platform:
   - INSTAGRAM/FACEBOOK: `engagement = likes + comments*2 + shares*3 + saves*2`
   - TIKTOK/YOUTUBE: `views`
   - SPOTIFY: skip (no per-post metrics)
2. Calcola baseline = mediana stessa metrica su ultimi 30d, stessa platform+mediaType del project
3. Ratio = postValue / max(baseline, 1)
4. Outcome:
   - `>= 2.0` → OUTLIER_HIGH
   - `>= 1.2` → ABOVE
   - `>= 0.8` → NORMAL
   - `>= 0.5` → BELOW
   - `< 0.5` → OUTLIER_LOW
5. Insight tags da caption: detect keyword (lyric, snippet, bts, behind, studio, day, q&a, freestyle, dj set, drop, release, reaction, duet) → array

## Cron

Estensione `app/api/cron/daily-sync/route.ts`:
- Dopo sync di ogni progetto, query `prisma.post.findMany({ where: { account: { projectId }, postedAt: { lte: now-48h, gte: now-72h }, postMortem: null }, include: { account: true } })`
- Per ogni post: chiama `evaluatePostMortem`, crea PostMortem
- Window 48-72h: target è 48h dopo pubblicazione, ma diamo finestra 24h al cron per recuperare se cron-skip

Job time complexity: O(N posts user/giorno) → typically <100. Negligible.

## Integration recommender

`lib/ai/context-builder.ts`: aggiungi `learnings.recentOutliers` al payload — array dei 5 più recenti OUTLIER_HIGH + 3 OUTLIER_LOW (non solo top, anche flop per evitare ripetere errori):

```ts
learnings: {
  recentOutliers: project.postMortems
    .filter(m => m.outcome === "OUTLIER_HIGH" || m.outcome === "OUTLIER_LOW")
    .slice(0, 8)
    .map(m => ({
      outcome: m.outcome,
      platform: m.platform,
      contentType: m.contentType,
      ratio: Number(m.ratio.toFixed(2)),
      insightTags: m.insightTags,
      captionSnippet: m.caption?.slice(0, 120),
    }))
}
```

Prompt update: sezione "Learning loop":

```
## Learning loop

Se context contiene `learnings.recentOutliers`, modula i prossimi suggerimenti:
- OUTLIER_HIGH (`outcome` = OUTLIER_HIGH): replica formula (kind+tags+caption tone)
  in 1-2 suggerimenti settimanali. Cita nel rationale "replico format X
  che ha fatto Y× la media".
- OUTLIER_LOW: evita pattern simili per ≥2 settimane. Cita nel rationale
  "evito format X che ha avuto Y× la media (sotto baseline)".
```

## API

```
GET /api/post-mortems   # lista per project (paginata)
                        # filtri ?outcome=OUTLIER_HIGH&platform=TIKTOK
```

Solo GET (read-only — sistema scrive, user legge).

## UI

Pagina `/learnings`:
- Hero card: numero post analizzati, % outlier high
- Lista PostMortem cards: badge outcome (verde/rosso), platform, ratio, caption snippet, insight tags
- Filtri tabs: Tutti / Top performer / Flop

`SidebarNav` aggiunge voce "Learnings" (icon `Sparkles`).

## Testing

```
lib/post-mortem.test.ts        # algoritmo: outcome buckets, insight tag extraction
app/api/post-mortems/route.test.ts  # 401, list, filtri
```

Target: +5 test (~124 totali).

## Migration

Single migration `m19_post_mortem`. Big bang OK.

## Out of scope

- Manual override outcome (user contesta)
- Predizione pre-pubblicazione (NeuroScore già fa questo lavoro)
- Confronto multi-progetto cross-pollination
- Insight tag via Claude (più costoso — manteniamo keyword detection client-side)
