# M16 — Multi-Project Design

**Date:** 2026-04-27
**Status:** Approved (pending implementation plan)
**Scope:** Refactor schema da `1 user = 1 artista` a `1 user = N progetti`. Generalizza `ArtistProfile` → `Project` con `kind` enum (ARTIST, YOUTUBER, INFLUENCER, DIVULGATORE, PODCASTER, BRAND).

## Context

L'app oggi assume 1 utente = 1 profilo artista musicale (model `ArtistProfile`, relazione 1:1 con `User`). Gli 11 model dominio attuali (`ArtistProfile`, `SocialAccount`, `Suggestion`, `Draft`, `BrandIdentity`, `StageNameIdea`, `DailyFeedback`, `NeuroScore`, `Persona`, `Campaign`, `Goal`) puntano direttamente a `userId`. Dopo M16: `ArtistProfile` eliminato e rimpiazzato da `Project`; gli altri 10 puntano a `projectId`.

**Obiettivo M16:** un utente può gestire più progetti creativi indipendenti (es. il proprio music project + un podcast laterale + un brand collab) e l'app supporta tipi di creator diversi dal musicista, in preparazione a M17 (onboarding wizard v2) e successivi.

**Ambiente:** dev only, nessun dato in produzione → migration "Big Bang" senza backfill. (Conferma utente Q1 = A.)

## Decisioni

| # | Domanda | Scelta |
|---|---|---|
| Q1 | Stato produzione | A — solo dev, nessun dato |
| Q2 | Nome model | D — `Project` |
| Q3 | Campaign kind-specific | C — polimorfismo (base + `details Json`) |
| Q4 | UX selezione progetto attivo | A — sidebar dropdown switcher + cookie |
| Q5 | Cap progetti per utente | C — soft cap 5 + override email allowlist |
| Q6 | Email feedback multi-progetto | A default (1 email aggregata/giorno) + C toggle per-progetto |

## Schema

### Nuovi enum / model

```prisma
enum CreatorKind {
  ARTIST
  YOUTUBER
  INFLUENCER
  DIVULGATORE
  PODCASTER
  BRAND
}

model Project {
  id                    String      @id @default(cuid())
  userId                String
  kind                  CreatorKind
  displayName           String
  niche                 String?
  city                  String?
  bio                   String?     @db.Text
  websiteUrl            String?
  emailFeedbackEnabled  Boolean     @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  socialAccounts  SocialAccount[]
  suggestions     Suggestion[]
  drafts          Draft[]
  brandIdentity   BrandIdentity?
  stageNameIdeas  StageNameIdea[]
  neuroScores     NeuroScore[]
  personas        Persona[]
  campaigns       Campaign[]
  goals           Goal[]
  dailyFeedback   DailyFeedback[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

### Modifiche Campaign (polimorfismo Q3)

```prisma
enum CampaignType {
  SINGOLO
  EP
  ALBUM
  LIVE
  MERCH
  VIDEO_DROP
  SERIES
  EPISODE
  SPONSOR
  EVENT
  PRODUCT
}

model Campaign {
  // ... campi esistenti
  details Json?
}
```

### Migrazione dei model dominio

Per ognuno dei 10 model elencati: rimuovi `userId`, aggiungi `projectId String`, relation `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`. Indici e unique constraints su `userId` → `projectId`:

| Model | Constraint da migrare |
|---|---|
| `BrandIdentity` | `userId @unique` → `projectId @unique` |
| `StageNameIdea` | `@@index([userId, createdAt])` → `@@index([projectId, createdAt])` |
| `DailyFeedback` | `@@unique([userId, forDate])` → `@@unique([projectId, forDate])` |
| `SocialAccount` | `@@unique([userId, platform, externalId])` → `@@unique([projectId, platform, externalId])`; index analogo |
| `Suggestion` | `@@index([userId, forDate])`, `@@index([userId, status])` → su `projectId` |
| `Draft` | `@@index([userId, status])`, `@@index([userId, scheduledFor])` → su `projectId` |
| `NeuroScore` | `@@index([userId])` → `@@index([projectId])` |
| `Persona` | `@@index([userId])` → `@@index([projectId])` |
| `Campaign` | `@@index([userId, releaseDate])` → su `projectId` |
| `Goal` | `@@index([userId, status])`, `@@index([userId, platform])` → su `projectId` |

`ArtistProfile` model viene **eliminato** (rimpiazzato da `Project`).

`User.artistProfile` relation rimossa. `User.projects: Project[]` aggiunta. Tutte le relations dirette `User → DomainModel[]` rimosse (passano via `Project`).

### Cap

Costante `MAX_PROJECTS_PER_USER = 5` in `lib/projects.ts`. Helper `canCreateProject(userId): Promise<boolean>`:
- Se `email ∈ EMAIL_ALLOWLIST` (normalizzata lowercase/trim) → `true` sempre
- Else: count progetti < 5

## Active Project state

### Cookie firmato

`active_project_id` HTTP-only, `Secure`, `SameSite=Lax`, signed con HMAC-SHA256 derivato da `AUTH_SECRET`. Formato: `<projectId>.<hmac>`.

### Helper `lib/active-project.ts`

```ts
getActiveProject(req): Promise<Project | null>
  // legge cookie, valida HMAC, valida ownership (project.userId === session.user.id)
  // fallback: primo Project del user ordered by createdAt asc
  // null solo se user.projects.length === 0

setActiveProject(res, projectId): Promise<void>
  // verifica ownership, scrive cookie firmato

requireActiveProject(req): Promise<Project>
  // throw RedirectError("/progetti?create=1") se null

withProject<T>(req, fn: (project: Project) => Promise<T>): Promise<T>
  // wrapper API route: auth + requireActiveProject + invoke fn
```

### Sicurezza ownership

Ogni read/write su entity dominio DEVE filtrare per `projectId` AND verificare `project.userId === session.user.id`. Cross-project access ritorna 404 (no info leak).

## API

### Nuove

| Endpoint | Comportamento |
|---|---|
| `GET /api/projects` | Lista progetti utente |
| `POST /api/projects` | Crea progetto (check `canCreateProject`, 403 se cap) |
| `PATCH /api/projects/[id]` | Update displayName/kind/niche/city/bio/websiteUrl/emailFeedbackEnabled |
| `DELETE /api/projects/[id]` | Cascade delete (UI conferma con type "DELETE") |
| `POST /api/projects/[id]/activate` | Set cookie `active_project_id` |

### Refactor

Tutte le API esistenti che oggi ricavano `userId` da session passano per `withProject(req, async (project) => { ... })`:

```
/api/suggestions/generate
/api/suggestions/[id]/{accept,reject}
/api/drafts/[id]
/api/marketing/{persona,campaign,score}
/api/brand/{stage-names,generate-identity,cover-brief}
/api/goals
/api/goals/[id]
/api/export/{drafts,calendar}
/api/metrics/sync
/api/connect/[platform]/start
```

## Cron jobs

### Daily-sync (07:00 IT)

```
for user in users:
  for project in user.projects:
    for account in project.socialAccounts:
      sync()  // try/catch isolato per account
    evaluate goals (project-scoped)  // try/catch isolato
```

### Evening-feedback (19:00 IT)

```
for user in users:
  enabled = user.projects.filter(p => p.emailFeedbackEnabled)
  for project in enabled:
    feedback = generateDailyFeedback(project)
    save DailyFeedback(projectId=project.id, ...)
  if enabled.length > 0 && resend_configured:
    sendAggregatedEmail(user, [feedback...])  // 1 email/giorno
```

## Email aggregata

Template Resend `daily-feedback-aggregated`:
- Hero: "I tuoi progetti oggi"
- Sezione per progetto: nome + kind badge + headline + body + link a `/calendario` filtrato

## Rate limit (M15.d)

Chiave attuale `userId` → `${userId}:${projectId}` per le 7 routes Anthropic. Limite globale aggiuntivo `${userId}` (es. 50 calls/ora total) per impedire abuso multi-progetto.

## UI

### Componenti nuovi

- `components/ProjectSwitcher.tsx` — dropdown sidebar header
- `components/ProjectKindBadge.tsx` — pill colorata per kind
- `components/CreateProjectModal.tsx` — form create
- `components/ProjectSettingsForm.tsx` — edit + email toggle + delete

### Pagine

- `app/(app)/progetti/page.tsx` — lista + crea + switch + impostazioni

### Pagine esistenti

- `SidebarNav.tsx`: `<ProjectSwitcher />` in header, voce nuova "Progetti" (icon `FolderKanban`)
- Tutte le pagine `(app)/*`: dati filtrati su progetto attivo, label dinamiche dove parlano di "artista" → mostrano `displayName` o `labels.creator`

### Label dinamiche `lib/kind-labels.ts`

```ts
export const labels: Record<CreatorKind, { creator: string; content: string; goal: string }> = {
  ARTIST:      { creator: "artista",      content: "post/video/reel", goal: "follower" },
  YOUTUBER:    { creator: "creator",      content: "video/short",     goal: "iscritti" },
  INFLUENCER:  { creator: "creator",      content: "post/reel/story", goal: "follower" },
  DIVULGATORE: { creator: "divulgatore",  content: "video/post",      goal: "iscritti" },
  PODCASTER:   { creator: "podcaster",    content: "episodi/clip",    goal: "ascoltatori" },
  BRAND:       { creator: "brand",        content: "post/campagne",   goal: "engagement" },
}
```

### Modulo Brand & Marketing

- `BrandIdentity`: universale
- `StageNameWizard` → `IdentityNameWizard`, prompt parametrico per kind
- `Persona` audience: prompt adatta domande per kind
- `Campaign`: form mostra subset `CampaignType` valido per kind

## AI prompts

### Context builder

`lib/ai/context-builder.ts` riceve `Project`. Aggiunge in cima al payload Claude:

```
PROGETTO ATTIVO
- Tipo: {kind} ({labels.creator})
- Nome: {displayName}
- Nicchia: {niche}
- Città: {city}
- Bio: {bio}
```

### System prompt kind-aware

`lib/ai/prompts.ts` — blocco aggiunto sotto cache control:

```
KIND-SPECIFIC GUIDELINES

Se kind=ARTIST: ciclo release musica (snippet→preview→drop→after). Reel 15-30s, snippet TikTok, IG carousel cover. KPI: stream Spotify, follower IG, save Reel.
Se kind=YOUTUBER: funnel trailer→upload→community→short. Short 60s, anteprime, thumbnail-first. KPI: iscritti, retention, watch time.
Se kind=INFLUENCER: lifestyle/storytelling continuativo. Reel storyline, carousel valore, story BTS. KPI: engagement, salvataggi, condivisioni.
Se kind=DIVULGATORE: autorità + accessibilità. Video lungo + clip estratte, carousel didattici, thread. KPI: completion, salvataggi, citazioni.
Se kind=PODCASTER: ciclo episodio (annuncio→drop→clip→guest cross-promo). Audiogram, clip 30-60s, carousel takeaway. KPI: download, completion, share clip.
Se kind=BRAND: awareness→consideration→conversione (no spam). Storytelling prodotto, UGC, case study. KPI: reach qualificato, click out, lead.
```

Stesso prompt cachato per tutti i kind, branching nel testo. Cache key invalida solo su modifica complessiva.

### Recommender

`lib/ai/recommender.ts::generateSuggestions(project)`. Tool-use schema invariato. Output salvato con `projectId`.

### Marketing

- Persona: prompt `"Genera 3 audience persona per {labels.creator} in nicchia {niche}"`
- Campaign: riceve `availableTypes: CampaignType[]` filtrato per kind
- NeuroScore: pesi `breakdown` invariati (segnali brain-predictive sono universali)

### Brand

- `generate-identity`: prompt aggiunge "per {kind}"
- `cover-brief`: titoli adattati per kind (cover singolo / thumbnail / cover episodio)
- `stage-names` → `identity-names`: prompt cambia per kind

## Error handling

| Scenario | Comportamento |
|---|---|
| Cookie punta a project deleted | Pulisci cookie, fallback primo progetto, redirect URL attuale |
| HMAC mismatch | Pulisci cookie, fallback come sopra |
| User senza progetti | Redirect `/progetti?create=1` |
| Cap raggiunto | 403 `{error: "max_projects_reached", limit: 5}`, UI toast + bottone disabilitato |
| Cross-project access | 404 (no info leak) |
| Delete con dati | Modal conferma type "DELETE", cascade DB |
| Cron sync fallisce per 1 progetto | Try/catch isolato, log `lastSyncError` |
| Email fallisce | Retry 1×, log + skip |

## Testing

Vitest, target ~70 test totali (50 attuali + ~20 nuovi).

```
lib/active-project.test.ts
  ✓ getActiveProject riconosce cookie valido
  ✓ getActiveProject rejects cross-user project
  ✓ getActiveProject fallback su primo progetto se no cookie
  ✓ setActiveProject signs cookie con HMAC
  ✓ HMAC tampering invalida cookie

lib/projects.test.ts
  ✓ canCreateProject false a 5 progetti
  ✓ canCreateProject true se email in allowlist (any count)
  ✓ canCreateProject usa email normalizzata (lowercase, trim)

lib/kind-labels.test.ts
  ✓ tutti CreatorKind hanno labels completi
  ✓ getLabel(kind, key) ritorna stringa non-empty

lib/ai/context-builder.test.ts
  ✓ context include kind block
  ✓ context include displayName + niche

lib/cron-helpers.test.ts
  ✓ groupFeedbackByUser aggrega N progetti in 1 email
  ✓ skip user con 0 progetti emailFeedbackEnabled

lib/export.test.ts (esteso)
  ✓ export filtra per projectId attivo
```

Almeno 1 test per ogni helper nuovo.

## Migration

```bash
prisma migrate reset --force
prisma migrate dev --name m16_multi_project
```

Niente backfill (DB vuoto per design Q1=A).

## Verifiche pre-commit

```
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

CI esistente (M14) gira tutto.

## Out of scope (M17+)

- Onboarding wizard v2 (M17)
- Trend ingestion (M18)
- Post-mortem auto (M19)
- Sotto-categorie kind (GAMER, COMEDIAN) — alter enum trivial dopo
- Multi-project collaboration (utenti che condividono un progetto)
- Project templates / clone
