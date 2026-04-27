# M16 Multi-Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor schema da `1 user = 1 artista` a `1 user = N progetti` con `kind` enum (ARTIST/YOUTUBER/INFLUENCER/DIVULGATORE/PODCASTER/BRAND) e UX project switcher.

**Architecture:** Big Bang migration (dev only, conferma utente Q1=A). Nuovo model `Project` rimpiazza `ArtistProfile`. 10 model dominio passano da `userId` a `projectId`. Cookie HMAC-firmato `active_project_id` traccia progetto attivo. Helper `withProject()` wrappa API per ownership check. AI prompts kind-aware via branching nel system prompt cachato. Cron iterano `Project` invece di `User`. Email feedback aggregata 1/giorno per utente.

**Tech Stack:** Next.js 15 App Router · TypeScript · Prisma 6 · PostgreSQL · Auth.js v5 · Anthropic SDK (`claude-sonnet-4-6`) · Resend · Vitest · Tailwind · lucide-react

**Spec:** `docs/superpowers/specs/2026-04-27-m16-multi-project-design.md`

---

## File Structure

### Nuovi file

```
lib/
  active-project.ts              # cookie HMAC + getActiveProject/setActive/requireActive/withProject
  active-project.test.ts
  projects.ts                    # canCreateProject + MAX + allowlist override
  projects.test.ts
  kind-labels.ts                 # mappa CreatorKind → labels UI/AI
  kind-labels.test.ts
  cron-helpers.ts                # groupFeedbackByUser + utilities multi-project
  cron-helpers.test.ts

app/api/projects/
  route.ts                       # GET, POST
  [id]/route.ts                  # PATCH, DELETE
  [id]/activate/route.ts         # POST

app/(app)/progetti/
  page.tsx                       # lista + crea + impostazioni

components/
  ProjectSwitcher.tsx            # dropdown sidebar
  ProjectKindBadge.tsx           # pill colorata
  CreateProjectModal.tsx         # form create
  ProjectSettingsForm.tsx        # edit + delete + email toggle
```

### File modificati

```
prisma/schema.prisma             # Project model, CreatorKind, refactor 10 model
lib/db.ts                        # nessuna modifica (re-export client)
lib/email.ts                     # +sendAggregatedDailyFeedbackEmail
lib/email.test.ts                # +test aggregata
lib/rate-limit.ts                # chiave userId → `${userId}:${projectId}`
lib/rate-limit.test.ts           # +test chiave composita
lib/sync.ts                      # accetta projectId invece di userId
lib/goals.ts                     # accetta projectId
lib/goals-helpers.ts             # invariato (pure funzioni)
lib/export.ts                    # accetta projectId
lib/export.test.ts               # +test filter projectId
lib/ai/context-builder.ts        # buildContext(projectId) + kind block
lib/ai/prompts.ts                # KIND-SPECIFIC GUIDELINES block
lib/ai/recommender.ts            # generateSuggestions(project)
lib/ai/feedback.ts               # generateDailyFeedback(project)
lib/ai/marketing/persona.ts      # kind-aware prompt
lib/ai/marketing/campaign.ts     # availableTypes per kind
lib/ai/marketing/score.ts        # invariato (segnali universali)
lib/ai/brand/identity.ts         # kind-aware prompt
lib/ai/brand/cover-brief.ts      # titoli per kind
lib/ai/brand/stage-names.ts      # kind-aware prompt
app/api/cron/daily-sync/route.ts        # loop progetti
app/api/cron/evening-feedback/route.ts  # email aggregata
app/api/suggestions/generate/route.ts   # withProject
app/api/suggestions/[id]/accept/route.ts
app/api/suggestions/[id]/reject/route.ts
app/api/drafts/[id]/route.ts
app/api/marketing/persona/route.ts
app/api/marketing/campaign/route.ts
app/api/marketing/score/route.ts
app/api/brand/stage-names/route.ts
app/api/brand/stage-names/[id]/choose/route.ts
app/api/brand/generate-identity/route.ts
app/api/brand/cover-brief/route.ts
app/api/goals/route.ts
app/api/goals/[id]/route.ts
app/api/export/drafts/route.ts
app/api/export/calendar/route.ts
app/api/metrics/sync/route.ts
app/api/connect/[platform]/start/route.ts
app/api/connect/meta/callback/route.ts
app/api/connect/youtube/callback/route.ts
app/api/connect/tiktok/callback/route.ts
app/api/spotify/monthly-listeners/route.ts
app/api/artist-profile/route.ts → diventa app/api/projects/route.ts (sostituito)
components/SidebarNav.tsx        # +ProjectSwitcher in header, voce "Progetti"
app/(app)/layout.tsx             # passa Project attivo a SidebarNav
app/(app)/page.tsx               # Dashboard filtra per projectId
app/(app)/calendario/page.tsx
app/(app)/suggerimenti/page.tsx
app/(app)/bozze/page.tsx
app/(app)/bozze/[id]/page.tsx
app/(app)/marketing/page.tsx
app/(app)/marketing/campagna/page.tsx
app/(app)/marketing/campagna/nuova/page.tsx
app/(app)/marketing/persona/page.tsx
app/(app)/brand/identita/page.tsx
app/(app)/brand/nome/page.tsx
app/(app)/obiettivi/page.tsx
app/(app)/analytics/[platform]/page.tsx
app/(app)/impostazioni/page.tsx
app/(app)/impostazioni/profilo/page.tsx → diventa /progetti
.env.example                     # documenta MAX_PROJECTS_PER_USER override
README.md                        # sezione Multi-project
```

### File eliminati

```
app/(app)/impostazioni/profilo/page.tsx   # rimpiazzato da /progetti
app/api/artist-profile/route.ts           # rimpiazzato da /api/projects
components/StageNameWizard.tsx            # mantenuto, accetta projectId
```

---

## Phase A — Foundation

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Riscrivi schema dominio**

Sostituisci `model ArtistProfile` con `model Project` e aggiungi `enum CreatorKind`:

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

In `model User` rimuovi `artistProfile`, `socialAccounts`, `suggestions`, `drafts`, `brandIdentity`, `stageNameIdeas`, `neuroScores`, `personas`, `campaigns`, `goals` e aggiungi:

```prisma
projects Project[]
```

User finale (mantenuti solo auth + projects):

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  timezone      String    @default("Europe/Rome")

  accounts  Account[]
  sessions  Session[]
  projects  Project[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Per OGNI model dominio sotto, sostituisci `userId String` con `projectId String` e la relation `user User @relation(...)` con `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`. Aggiorna unique/index.

**`BrandIdentity`:**
```prisma
model BrandIdentity {
  id           String   @id @default(cuid())
  projectId    String   @unique
  palette      Json?
  typography   Json?
  toneOfVoice  Json?
  moodKeywords String[]
  logoBrief    String?  @db.Text
  logoSvg      String?  @db.Text
  claudeDesignPrompt String? @db.Text
  mjPrompt     String?  @db.Text
  coverBriefs  Json?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**`StageNameIdea`:**
```prisma
model StageNameIdea {
  id           String   @id @default(cuid())
  projectId    String
  name         String
  rationale    String   @db.Text
  availability Json?
  chosen       Boolean  @default(false)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([projectId, createdAt])
}
```

**`DailyFeedback`:**
```prisma
model DailyFeedback {
  id          String   @id @default(cuid())
  projectId   String
  forDate     DateTime
  headline    String   @db.Text
  body        String   @db.Text
  postsCount  Int      @default(0)
  generatedBy String?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([projectId, forDate])
  @@index([projectId, forDate])
}
```

**`SocialAccount`:**
```prisma
model SocialAccount {
  id                String   @id @default(cuid())
  projectId         String
  platform          Platform
  handle            String
  externalId        String
  accessTokenEnc    String   @db.Text
  refreshTokenEnc   String?  @db.Text
  expiresAt         DateTime?
  scopes            String[]
  meta              Json?
  lastSyncedAt      DateTime?
  lastSyncError     String?  @db.Text

  project           Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  metrics           MetricSnapshot[]
  posts             Post[]
  audienceInsights  AudienceInsight[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectId, platform, externalId])
  @@index([projectId, platform])
}
```

**`Suggestion`:**
```prisma
model Suggestion {
  id            String      @id @default(cuid())
  projectId     String
  forDate       DateTime
  platform      Platform
  contentType   ContentType
  hook          String      @db.Text
  caption       String      @db.Text
  hashtags      String[]
  cta           String?
  suggestedTime String?
  rationale     String?     @db.Text
  status        SuggestionStatus @default(PROPOSED)
  generatedBy   String?
  campaignId    String?

  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  draft      Draft?
  campaign   Campaign?   @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  neuroScore NeuroScore?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, forDate])
  @@index([projectId, status])
  @@index([campaignId])
}
```

**`Draft`:**
```prisma
model Draft {
  id            String      @id @default(cuid())
  projectId     String
  suggestionId  String?     @unique
  platform      Platform
  contentType   ContentType
  scheduledFor  DateTime?
  caption       String      @db.Text
  hashtags      String[]
  mediaNotes    String?     @db.Text
  checklist     Json?
  status        DraftStatus @default(TODO)

  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  suggestion Suggestion? @relation(fields: [suggestionId], references: [id])
  neuroScore NeuroScore?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
  @@index([projectId, scheduledFor])
}
```

**`NeuroScore`:**
```prisma
model NeuroScore {
  id           String   @id @default(cuid())
  projectId    String
  suggestionId String?  @unique
  draftId      String?  @unique
  score        Int
  breakdown    Json
  improvements Json
  generatedBy  String?

  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  suggestion Suggestion? @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  draft      Draft?      @relation(fields: [draftId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([projectId])
}
```

**`Persona`:**
```prisma
model Persona {
  id             String  @id @default(cuid())
  projectId      String
  name           String
  ageRange       String
  location       String
  occupation     String
  musicHabits    String  @db.Text
  platforms      String[]
  listeningTimes String?
  triggers       Json
  culturalRefs   Json
  generatedBy    String?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
}
```

**`Campaign`:** aggiungi `details Json?` e nuovi enum values:
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
  id          String         @id @default(cuid())
  projectId   String
  title       String
  type        CampaignType
  releaseDate DateTime
  preSaveUrl  String?
  goal        String?        @db.Text
  status      CampaignStatus @default(DRAFT)
  generatedBy String?
  details     Json?

  project     Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  suggestions Suggestion[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, releaseDate])
}
```

**`Goal`:**
```prisma
model Goal {
  id          String     @id @default(cuid())
  projectId   String
  platform    Platform
  metric      GoalMetric
  targetValue Int
  targetDate  DateTime?
  startValue  Int        @default(0)
  startedAt   DateTime   @default(now())
  achievedAt  DateTime?
  status      GoalStatus @default(ACTIVE)
  note        String?    @db.Text

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
  @@index([projectId, platform])
}
```

ELIMINA `model ArtistProfile` interamente.

- [ ] **Step 1.2: Reset DB e crea migration**

```bash
cd /Users/gabrielevalentino/socialmediamanager
pnpm exec prisma migrate reset --force --skip-seed
pnpm exec prisma migrate dev --name m16_multi_project
pnpm exec prisma generate
```

Atteso: migration creata in `prisma/migrations/<ts>_m16_multi_project/`, client rigenerato senza errori.

- [ ] **Step 1.3: Verifica typecheck (rotto previsto)**

```bash
pnpm typecheck
```

Atteso: errori in cascata su tutti i file che usano `userId` su model dominio. Va bene — task successivi li sistemano.

- [ ] **Step 1.4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(M16): schema multi-project — Project model + CreatorKind enum

Refactor schema da 1 user = 1 artista a 1 user = N progetti.
ArtistProfile eliminato, rimpiazzato da Project con kind enum
(ARTIST/YOUTUBER/INFLUENCER/DIVULGATORE/PODCASTER/BRAND).
10 model dominio passano da userId a projectId. Migration big bang
(dev only). Typecheck rotto come previsto — fix nei task successivi."
```

---

### Task 2: lib/kind-labels.ts (TDD)

**Files:**
- Create: `lib/kind-labels.ts`
- Test: `lib/kind-labels.test.ts`

- [ ] **Step 2.1: Scrivi test che fallisce**

```ts
// lib/kind-labels.test.ts
import { describe, it, expect } from "vitest";
import { CreatorKind } from "@prisma/client";
import { getKindLabels, KIND_LABELS } from "./kind-labels";

describe("kind-labels", () => {
  it("ha labels per ogni CreatorKind", () => {
    for (const kind of Object.values(CreatorKind)) {
      const labels = KIND_LABELS[kind];
      expect(labels).toBeDefined();
      expect(labels.creator.length).toBeGreaterThan(0);
      expect(labels.content.length).toBeGreaterThan(0);
      expect(labels.goal.length).toBeGreaterThan(0);
    }
  });

  it("getKindLabels ritorna labels corretti per ARTIST", () => {
    const labels = getKindLabels("ARTIST");
    expect(labels.creator).toBe("artista");
  });

  it("getKindLabels ritorna labels corretti per PODCASTER", () => {
    const labels = getKindLabels("PODCASTER");
    expect(labels.goal).toBe("ascoltatori");
  });
});
```

- [ ] **Step 2.2: Run test, verifica fail**

```bash
pnpm vitest run lib/kind-labels.test.ts
```

Atteso: FAIL — modulo non esiste.

- [ ] **Step 2.3: Implementa minimal**

```ts
// lib/kind-labels.ts
import type { CreatorKind } from "@prisma/client";

export interface KindLabels {
  creator: string;
  content: string;
  goal: string;
}

export const KIND_LABELS: Record<CreatorKind, KindLabels> = {
  ARTIST:      { creator: "artista",      content: "post/video/reel", goal: "follower" },
  YOUTUBER:    { creator: "creator",      content: "video/short",     goal: "iscritti" },
  INFLUENCER:  { creator: "creator",      content: "post/reel/story", goal: "follower" },
  DIVULGATORE: { creator: "divulgatore",  content: "video/post",      goal: "iscritti" },
  PODCASTER:   { creator: "podcaster",    content: "episodi/clip",    goal: "ascoltatori" },
  BRAND:       { creator: "brand",        content: "post/campagne",   goal: "engagement" },
};

export function getKindLabels(kind: CreatorKind): KindLabels {
  return KIND_LABELS[kind];
}

export const KIND_DISPLAY: Record<CreatorKind, string> = {
  ARTIST:      "Artista / Producer",
  YOUTUBER:    "YouTuber",
  INFLUENCER:  "Influencer",
  DIVULGATORE: "Divulgatore",
  PODCASTER:   "Podcaster",
  BRAND:       "Brand",
};

// Subset CampaignType valido per kind
import type { CampaignType } from "@prisma/client";

export const KIND_CAMPAIGN_TYPES: Record<CreatorKind, CampaignType[]> = {
  ARTIST:      ["SINGOLO", "EP", "ALBUM", "LIVE", "MERCH", "EVENT"],
  YOUTUBER:    ["VIDEO_DROP", "SERIES", "SPONSOR", "EVENT", "MERCH"],
  INFLUENCER:  ["VIDEO_DROP", "SPONSOR", "EVENT", "MERCH", "PRODUCT"],
  DIVULGATORE: ["VIDEO_DROP", "SERIES", "EVENT", "PRODUCT"],
  PODCASTER:   ["EPISODE", "SERIES", "SPONSOR", "EVENT"],
  BRAND:       ["PRODUCT", "EVENT", "SPONSOR"],
};
```

- [ ] **Step 2.4: Run test, verifica pass**

```bash
pnpm vitest run lib/kind-labels.test.ts
```

Atteso: PASS (3 test).

- [ ] **Step 2.5: Commit**

```bash
git add lib/kind-labels.ts lib/kind-labels.test.ts
git commit -m "feat(M16): lib/kind-labels — mappa CreatorKind → labels UI/AI"
```

---

### Task 3: lib/projects.ts canCreateProject (TDD)

**Files:**
- Create: `lib/projects.ts`
- Test: `lib/projects.test.ts`

- [ ] **Step 3.1: Scrivi test**

```ts
// lib/projects.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { canCreateProject, MAX_PROJECTS_PER_USER, isAllowlisted } from "./projects";

vi.mock("@/lib/db", () => ({
  prisma: {
    project: { count: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("projects helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EMAIL_ALLOWLIST;
  });

  it("MAX_PROJECTS_PER_USER è 5", () => {
    expect(MAX_PROJECTS_PER_USER).toBe(5);
  });

  it("isAllowlisted false se EMAIL_ALLOWLIST non set", () => {
    expect(isAllowlisted("foo@bar.com")).toBe(false);
  });

  it("isAllowlisted normalizza email (lowercase + trim)", () => {
    process.env.EMAIL_ALLOWLIST = "FOO@bar.COM, baz@qux.io";
    expect(isAllowlisted("  foo@BAR.com ")).toBe(true);
    expect(isAllowlisted("baz@qux.io")).toBe(true);
    expect(isAllowlisted("nope@nope.io")).toBe(false);
  });

  it("canCreateProject false a 5 progetti, no allowlist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ email: "user@test.io" });
    (prisma.project.count as any).mockResolvedValue(5);
    expect(await canCreateProject("u1")).toBe(false);
  });

  it("canCreateProject true a 4 progetti", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ email: "user@test.io" });
    (prisma.project.count as any).mockResolvedValue(4);
    expect(await canCreateProject("u1")).toBe(true);
  });

  it("canCreateProject true a 99 progetti se allowlisted", async () => {
    process.env.EMAIL_ALLOWLIST = "owner@test.io";
    (prisma.user.findUnique as any).mockResolvedValue({ email: "owner@test.io" });
    (prisma.project.count as any).mockResolvedValue(99);
    expect(await canCreateProject("u1")).toBe(true);
  });

  it("canCreateProject false se user non trovato", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    expect(await canCreateProject("ghost")).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run test, verifica fail**

```bash
pnpm vitest run lib/projects.test.ts
```

Atteso: FAIL.

- [ ] **Step 3.3: Implementa**

```ts
// lib/projects.ts
import { prisma } from "@/lib/db";

export const MAX_PROJECTS_PER_USER = 5;

export function isAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.EMAIL_ALLOWLIST;
  if (!raw) return false;
  const norm = email.trim().toLowerCase();
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(norm);
}

export async function canCreateProject(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return false;
  if (isAllowlisted(user.email)) return true;
  const count = await prisma.project.count({ where: { userId } });
  return count < MAX_PROJECTS_PER_USER;
}
```

- [ ] **Step 3.4: Run test, verifica pass**

```bash
pnpm vitest run lib/projects.test.ts
```

Atteso: PASS (6 test).

- [ ] **Step 3.5: Commit**

```bash
git add lib/projects.ts lib/projects.test.ts
git commit -m "feat(M16): lib/projects — canCreateProject + cap 5 + allowlist override"
```

---

### Task 4: lib/active-project.ts cookie HMAC (TDD)

**Files:**
- Create: `lib/active-project.ts` (parte 1: sign/verify)
- Test: `lib/active-project.test.ts` (parte 1)

- [ ] **Step 4.1: Scrivi test sign/verify**

```ts
// lib/active-project.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { signProjectCookie, verifyProjectCookie } from "./active-project";

describe("active-project cookie HMAC", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test_secret_for_unit_tests_only_xxxxx";
  });

  it("signProjectCookie produce stringa formato projectId.hmac", () => {
    const cookie = signProjectCookie("proj_abc");
    expect(cookie).toMatch(/^proj_abc\.[a-f0-9]+$/);
  });

  it("verifyProjectCookie ritorna projectId per cookie valido", () => {
    const cookie = signProjectCookie("proj_abc");
    expect(verifyProjectCookie(cookie)).toBe("proj_abc");
  });

  it("verifyProjectCookie ritorna null se HMAC tampered", () => {
    const cookie = signProjectCookie("proj_abc");
    const tampered = cookie.replace(/.$/, "0");
    expect(verifyProjectCookie(tampered)).toBeNull();
  });

  it("verifyProjectCookie ritorna null se projectId tampered", () => {
    const cookie = signProjectCookie("proj_abc");
    const parts = cookie.split(".");
    const tampered = `proj_xyz.${parts[1]}`;
    expect(verifyProjectCookie(tampered)).toBeNull();
  });

  it("verifyProjectCookie ritorna null se formato invalido", () => {
    expect(verifyProjectCookie("garbage")).toBeNull();
    expect(verifyProjectCookie("")).toBeNull();
    expect(verifyProjectCookie("proj_abc")).toBeNull();
  });
});
```

- [ ] **Step 4.2: Run test, verifica fail**

```bash
pnpm vitest run lib/active-project.test.ts
```

Atteso: FAIL — modulo non esiste.

- [ ] **Step 4.3: Implementa sign/verify**

```ts
// lib/active-project.ts
import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET non configurato");
  return Buffer.from(s, "utf8");
}

function hmac(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function signProjectCookie(projectId: string): string {
  return `${projectId}.${hmac(projectId)}`;
}

export function verifyProjectCookie(cookie: string | undefined | null): string | null {
  if (!cookie) return null;
  const idx = cookie.lastIndexOf(".");
  if (idx <= 0) return null;
  const projectId = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  if (!projectId || !sig) return null;
  const expected = hmac(projectId);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  return projectId;
}
```

- [ ] **Step 4.4: Run test, verifica pass**

```bash
pnpm vitest run lib/active-project.test.ts
```

Atteso: PASS (5 test).

- [ ] **Step 4.5: Commit**

```bash
git add lib/active-project.ts lib/active-project.test.ts
git commit -m "feat(M16): lib/active-project — cookie HMAC sign/verify (timing-safe)"
```

---

### Task 5: lib/active-project.ts get/set/require/withProject (TDD)

**Files:**
- Modify: `lib/active-project.ts` (aggiungi)
- Modify: `lib/active-project.test.ts` (aggiungi)

- [ ] **Step 5.1: Scrivi test**

Aggiungi a `lib/active-project.test.ts`:

```ts
import { vi } from "vitest";
import {
  getActiveProject,
  setActiveProjectCookie,
  withProject,
  ACTIVE_PROJECT_COOKIE,
} from "./active-project";

vi.mock("@/lib/db", () => ({
  prisma: { project: { findFirst: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";
import { auth } from "@/auth";

describe("getActiveProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test_secret_for_unit_tests_only_xxxxx";
  });

  it("ritorna progetto se cookie firmato valido + ownership ok", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "p1",
      userId: "u1",
      kind: "ARTIST",
    });
    const cookie = signProjectCookie("p1");
    const fakeReq = {
      cookies: { get: (n: string) => (n === ACTIVE_PROJECT_COOKIE ? { value: cookie } : undefined) },
    } as any;
    const project = await getActiveProject(fakeReq);
    expect(project?.id).toBe("p1");
  });

  it("rejects cookie cross-user (project.userId !== session.user.id)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "OTHER" });
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p_fallback", userId: "u1" });
    const cookie = signProjectCookie("p1");
    const fakeReq = {
      cookies: { get: () => ({ value: cookie }) },
    } as any;
    const project = await getActiveProject(fakeReq);
    expect(project?.id).toBe("p_fallback");
  });

  it("fallback al primo progetto se no cookie", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p_first", userId: "u1" });
    const fakeReq = { cookies: { get: () => undefined } } as any;
    const project = await getActiveProject(fakeReq);
    expect(project?.id).toBe("p_first");
  });

  it("ritorna null se user senza progetti", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findFirst as any).mockResolvedValue(null);
    const fakeReq = { cookies: { get: () => undefined } } as any;
    expect(await getActiveProject(fakeReq)).toBeNull();
  });

  it("ritorna null se non autenticato", async () => {
    (auth as any).mockResolvedValue(null);
    const fakeReq = { cookies: { get: () => undefined } } as any;
    expect(await getActiveProject(fakeReq)).toBeNull();
  });
});
```

- [ ] **Step 5.2: Run test, verifica fail**

```bash
pnpm vitest run lib/active-project.test.ts
```

Atteso: FAIL — funzioni non esistono.

- [ ] **Step 5.3: Implementa**

Aggiungi a `lib/active-project.ts`:

```ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Project } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies as nextCookies } from "next/headers";

export const ACTIVE_PROJECT_COOKIE = "active_project_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface MinimalReq {
  cookies: { get: (name: string) => { value: string } | undefined };
}

export async function getActiveProject(req?: MinimalReq): Promise<Project | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  let cookieVal: string | undefined;
  if (req?.cookies?.get) {
    cookieVal = req.cookies.get(ACTIVE_PROJECT_COOKIE)?.value;
  } else {
    try {
      const store = await nextCookies();
      cookieVal = store.get(ACTIVE_PROJECT_COOKIE)?.value;
    } catch {
      cookieVal = undefined;
    }
  }

  const projectId = verifyProjectCookie(cookieVal);
  if (projectId) {
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    if (proj && proj.userId === userId) return proj;
  }

  return prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireActiveProject(req?: MinimalReq): Promise<Project> {
  const proj = await getActiveProject(req);
  if (!proj) {
    const err = new Error("NO_ACTIVE_PROJECT");
    (err as any).status = 412;
    throw err;
  }
  return proj;
}

export async function setActiveProjectCookie(
  res: NextResponse,
  userId: string,
  projectId: string,
): Promise<void> {
  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (!proj || proj.userId !== userId) {
    throw new Error("PROJECT_NOT_OWNED");
  }
  res.cookies.set({
    name: ACTIVE_PROJECT_COOKIE,
    value: signProjectCookie(projectId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function withProject<T>(
  req: NextRequest,
  fn: (project: Project) => Promise<T>,
): Promise<T> {
  const project = await requireActiveProject(req);
  return fn(project);
}
```

- [ ] **Step 5.4: Run test, verifica pass**

```bash
pnpm vitest run lib/active-project.test.ts
```

Atteso: PASS (10 test totali).

- [ ] **Step 5.5: Commit**

```bash
git add lib/active-project.ts lib/active-project.test.ts
git commit -m "feat(M16): lib/active-project — get/set/require/withProject helpers"
```

---

## Phase B — Project CRUD API

### Task 6: GET + POST /api/projects

**Files:**
- Create: `app/api/projects/route.ts`

- [ ] **Step 6.1: Implementa route**

```ts
// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canCreateProject, MAX_PROJECTS_PER_USER } from "@/lib/projects";
import { CreatorKind } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      displayName: true,
      niche: true,
      city: true,
      emailFeedbackEnabled: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ projects });
}

const CreateBody = z.object({
  kind: z.nativeEnum(CreatorKind),
  displayName: z.string().min(1).max(80),
  niche: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const allowed = await canCreateProject(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: "max_projects_reached", limit: MAX_PROJECTS_PER_USER },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await prisma.project.create({
    data: {
      userId,
      kind: parsed.data.kind,
      displayName: parsed.data.displayName,
      niche: parsed.data.niche || null,
      city: parsed.data.city || null,
      bio: parsed.data.bio || null,
      websiteUrl: parsed.data.websiteUrl || null,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
```

- [ ] **Step 6.2: Verifica typecheck**

```bash
pnpm typecheck 2>&1 | grep "app/api/projects/route.ts"
```

Atteso: nessun errore in questo file.

- [ ] **Step 6.3: Commit**

```bash
git add app/api/projects/route.ts
git commit -m "feat(M16): API GET/POST /api/projects con cap check"
```

---

### Task 7: PATCH + DELETE /api/projects/[id]

**Files:**
- Create: `app/api/projects/[id]/route.ts`

- [ ] **Step 7.1: Implementa**

```ts
// app/api/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CreatorKind } from "@prisma/client";

const UpdateBody = z.object({
  kind: z.nativeEnum(CreatorKind).optional(),
  displayName: z.string().min(1).max(80).optional(),
  niche: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional().or(z.literal("")),
  emailFeedbackEnabled: z.boolean().optional(),
});

async function ownProject(userId: string, projectId: string) {
  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (!proj || proj.userId !== userId) return null;
  return proj;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proj = await ownProject(session.user.id, id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === "") data[k] = null;
    else data[k] = v;
  }

  const updated = await prisma.project.update({ where: { id }, data });
  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proj = await ownProject(session.user.id, id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7.2: Commit**

```bash
git add app/api/projects/[id]/route.ts
git commit -m "feat(M16): API PATCH/DELETE /api/projects/[id]"
```

---

### Task 8: POST /api/projects/[id]/activate

**Files:**
- Create: `app/api/projects/[id]/activate/route.ts`

- [ ] **Step 8.1: Implementa**

```ts
// app/api/projects/[id]/activate/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setActiveProjectCookie } from "@/lib/active-project";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const res = NextResponse.json({ ok: true, projectId: id });
  try {
    await setActiveProjectCookie(res, session.user.id, id);
  } catch (err) {
    if ((err as Error).message === "PROJECT_NOT_OWNED") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
  return res;
}
```

- [ ] **Step 8.2: Commit**

```bash
git add app/api/projects/[id]/activate/route.ts
git commit -m "feat(M16): API POST /api/projects/[id]/activate (set cookie)"
```

---

## Phase C — Refactor API esistenti

Pattern uniforme: ogni route che oggi fa `const session = await auth(); const userId = session.user.id` passa a `withProject(req, async (project) => { ... })` e sostituisce `userId` con `project.id` nelle query.

### Task 9: Refactor /api/suggestions/* + /api/drafts/[id]

**Files:**
- Modify: `app/api/suggestions/generate/route.ts`
- Modify: `app/api/suggestions/[id]/accept/route.ts`
- Modify: `app/api/suggestions/[id]/reject/route.ts`
- Modify: `app/api/suggestions/[id]/route.ts` (se esiste handler)
- Modify: `app/api/drafts/[id]/route.ts`

- [ ] **Step 9.1: Pattern di refactor**

Per ognuno dei file: leggi handler esistente, sostituisci skeleton:

```ts
// PRIMA
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  // ... logica con userId
}

// DOPO
import { withProject } from "@/lib/active-project";

export async function POST(req: NextRequest) {
  try {
    return await withProject(req, async (project) => {
      // ... logica con project.id (sostituisci userId con project.id ovunque)
    });
  } catch (err) {
    if ((err as Error).message === "NO_ACTIVE_PROJECT") {
      return NextResponse.json({ error: "no_active_project" }, { status: 412 });
    }
    throw err;
  }
}
```

Per route che leggono entity by id: aggiungi controllo `entity.projectId !== project.id` → 404.

Esempio `/api/drafts/[id]/route.ts`:

```ts
return await withProject(req, async (project) => {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft || draft.projectId !== project.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // ... operazione su draft
});
```

Per `/api/suggestions/generate`: la chiamata a `generateSuggestions(userId)` diventa `generateSuggestions(project)` (Task 16 aggiorna firma).

- [ ] **Step 9.2: Verifica typecheck mirato**

```bash
pnpm typecheck 2>&1 | grep -E "app/api/(suggestions|drafts)"
```

Atteso: nessun errore residuo in questi file (residui altrove OK).

- [ ] **Step 9.3: Commit**

```bash
git add app/api/suggestions app/api/drafts
git commit -m "refactor(M16): API suggestions/drafts → withProject"
```

---

### Task 10: Refactor /api/marketing/* + /api/brand/*

**Files:**
- Modify: `app/api/marketing/persona/route.ts`
- Modify: `app/api/marketing/campaign/route.ts`
- Modify: `app/api/marketing/score/route.ts`
- Modify: `app/api/brand/stage-names/route.ts`
- Modify: `app/api/brand/stage-names/[id]/route.ts`
- Modify: `app/api/brand/stage-names/[id]/choose/route.ts`
- Modify: `app/api/brand/generate-identity/route.ts`
- Modify: `app/api/brand/cover-brief/route.ts`

- [ ] **Step 10.1: Applica pattern Task 9.1 a tutti**

Per ogni route: wrappa handler con `withProject(req, async (project) => { ... })`. Sostituisci `userId` con `project.id` in tutte le query Prisma. Per chiamate AI (es. `generatePersonas`, `generateCampaign`, `generateBrandIdentity`, `generateStageNames`, `generateCoverBrief`) passa `project` invece di `userId`/`artistProfile` (firme aggiornate Task 14-15).

- [ ] **Step 10.2: Commit**

```bash
git add app/api/marketing app/api/brand
git commit -m "refactor(M16): API marketing/brand → withProject"
```

---

### Task 11: Refactor /api/goals/* + /api/export/*

**Files:**
- Modify: `app/api/goals/route.ts`
- Modify: `app/api/goals/[id]/route.ts`
- Modify: `app/api/export/drafts/route.ts`
- Modify: `app/api/export/calendar/route.ts`

- [ ] **Step 11.1: Applica pattern**

Wrappa con `withProject`. Le query `goal` filtrano per `projectId`. Per `/api/export/calendar` (sottoscrivibile via feed key): la feed key deve essere ancora derivata da `userId + AUTH_SECRET` (resta legata all'utente per evitare di rompere subscription esistenti), ma il filtro entity passa per `projectId`. Aggiungi parametro query `?projectId=X` opzionale che, se presente, filtra; se assente, default = primo progetto attivo.

```ts
// app/api/export/calendar/route.ts skeleton
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const feedKey = url.searchParams.get("k");
  const requestedProjectId = url.searchParams.get("projectId");
  const ownerId = process.env.CALENDAR_FEED_OWNER_ID;
  if (!ownerId) return new NextResponse("not configured", { status: 404 });
  if (!isValidFeedKey(feedKey, ownerId)) return new NextResponse("forbidden", { status: 403 });

  const projects = await prisma.project.findMany({ where: { userId: ownerId }, orderBy: { createdAt: "asc" } });
  const target = requestedProjectId
    ? projects.find((p) => p.id === requestedProjectId)
    : projects[0];
  if (!target) return new NextResponse("no project", { status: 404 });

  const drafts = await prisma.draft.findMany({
    where: { projectId: target.id, scheduledFor: { not: null } },
    orderBy: { scheduledFor: "asc" },
  });
  const ics = buildICalendar(drafts, target.displayName);
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
```

- [ ] **Step 11.2: Aggiorna test export**

In `lib/export.test.ts` aggiungi:

```ts
it("buildICalendar usa displayName progetto nel SUMMARY prefix se passato", () => {
  const ics = buildICalendar([fakeDraft], "Mio Progetto");
  expect(ics).toContain("SUMMARY:[Mio Progetto]");
});
```

In `lib/export.ts` modifica firma `buildICalendar(drafts, projectLabel?)` per prependere `[projectLabel]` allo SUMMARY se passato.

- [ ] **Step 11.3: Run test**

```bash
pnpm vitest run lib/export.test.ts
```

Atteso: PASS.

- [ ] **Step 11.4: Commit**

```bash
git add app/api/goals app/api/export lib/export.ts lib/export.test.ts
git commit -m "refactor(M16): API goals/export → withProject + projectId in calendar feed"
```

---

### Task 12: Refactor /api/metrics + /api/connect + /api/spotify + cleanup artist-profile

**Files:**
- Modify: `app/api/metrics/sync/route.ts`
- Modify: `app/api/connect/[platform]/start/route.ts`
- Modify: `app/api/connect/meta/callback/route.ts`
- Modify: `app/api/connect/youtube/callback/route.ts`
- Modify: `app/api/connect/tiktok/callback/route.ts`
- Modify: `app/api/spotify/monthly-listeners/route.ts`
- Delete: `app/api/artist-profile/route.ts`

- [ ] **Step 12.1: Refactor pattern withProject**

Per ognuno: wrappa con `withProject`. Per OAuth callbacks: il `state` param OAuth deve includere `projectId` insieme a `userId` (firmato HMAC con `AUTH_SECRET`). Vedi `lib/active-project.ts::signProjectCookie` per pattern. Crea helper inline:

```ts
// in lib/active-project.ts (estensione)
import { createHmac } from "node:crypto";

export function signOAuthState(payload: Record<string, string>): string {
  const json = JSON.stringify(payload);
  const sig = createHmac("sha256", getSecret()).update(json).digest("hex");
  return Buffer.from(`${json}.${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string): Record<string, string> | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf(".");
    if (idx <= 0) return null;
    const json = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const expected = createHmac("sha256", getSecret()).update(json).digest("hex");
    if (sig !== expected) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}
```

In `start` route: `signOAuthState({ userId, projectId })`. In `callback`: `verifyOAuthState(state)` → estrai `projectId` per `socialAccount.create({ data: { projectId, ... } })`.

- [ ] **Step 12.2: Test signOAuthState**

Aggiungi a `lib/active-project.test.ts`:

```ts
it("signOAuthState + verifyOAuthState round-trip", () => {
  const state = signOAuthState({ userId: "u1", projectId: "p1", platform: "tiktok" });
  expect(verifyOAuthState(state)).toEqual({ userId: "u1", projectId: "p1", platform: "tiktok" });
});

it("verifyOAuthState rejects tampered state", () => {
  const state = signOAuthState({ userId: "u1", projectId: "p1" });
  const tampered = state.slice(0, -2) + "00";
  expect(verifyOAuthState(tampered)).toBeNull();
});
```

```bash
pnpm vitest run lib/active-project.test.ts
```

Atteso: PASS.

- [ ] **Step 12.3: Elimina artist-profile route**

```bash
rm -rf app/api/artist-profile
```

(rimpiazzato da `/api/projects/[id]` PATCH).

- [ ] **Step 12.4: Commit**

```bash
git add app/api/metrics app/api/connect app/api/spotify lib/active-project.ts lib/active-project.test.ts
git rm -r app/api/artist-profile
git commit -m "refactor(M16): API metrics/connect/spotify → withProject + OAuth state firmato con projectId"
```

---

## Phase D — AI prompts kind-aware

### Task 13: Refactor lib/ai/context-builder.ts (Project param + kind block)

**Files:**
- Modify: `lib/ai/context-builder.ts`

- [ ] **Step 13.1: Riscrivi firma + interfaccia**

```ts
// lib/ai/context-builder.ts
import type { Project, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface AccountSummary {
  platform: Platform;
  handle: string;
  connected: boolean;
  followers?: number;
  followersDelta7d?: number;
  followersDelta30d?: number;
  avgViewsLast20?: number;
  topPosts?: Array<{
    postedAt: string;
    mediaType: string;
    likes?: number | null;
    comments?: number | null;
    reach?: number | null;
    views?: number | null;
    caption?: string | null;
  }>;
  audience?: {
    ageBuckets?: unknown;
    topCountries?: unknown;
  } | null;
  notes?: string;
}

export interface RecommenderContext {
  today: string;
  timezone: string;
  project: {
    kind: string;
    displayName: string;
    niche?: string | null;
    city?: string | null;
    bio?: string | null;
  };
  accounts: AccountSummary[];
  calendarAhead: {
    upcomingReleases?: string[];
    liveDates?: string[];
  };
}

export async function buildContext(projectId: string): Promise<RecommenderContext> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      user: { select: { timezone: true } },
      socialAccounts: {
        include: {
          metrics: { orderBy: { capturedAt: "desc" }, take: 30 },
          posts: { orderBy: { postedAt: "desc" }, take: 20 },
          audienceInsights: { orderBy: { capturedAt: "desc" }, take: 1 },
        },
      },
      campaigns: { where: { status: "ACTIVE" } },
    },
  });

  // Riusa logica esistente per derivare AccountSummary[] da project.socialAccounts
  // (mantieni le funzioni helper interne così come sono nel file attuale,
  // semplicemente sostituisci `user.socialAccounts` con `project.socialAccounts`)

  // ... (corpo invariato per il resto)

  return {
    today: new Date().toISOString().slice(0, 10),
    timezone: project.user.timezone,
    project: {
      kind: project.kind,
      displayName: project.displayName,
      niche: project.niche,
      city: project.city,
      bio: project.bio,
    },
    accounts: /* derivato come prima */ [],
    calendarAhead: { upcomingReleases: [], liveDates: [] },
  };
}
```

Mantieni invariata la logica di calcolo delta, top posts, ecc. Sostituisci solo le sorgenti.

- [ ] **Step 13.2: Test context-builder**

Crea `lib/ai/context-builder.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { buildContext } from "./context-builder";

vi.mock("@/lib/db", () => ({
  prisma: { project: { findUniqueOrThrow: vi.fn() } },
}));
import { prisma } from "@/lib/db";

describe("buildContext", () => {
  it("include project block con kind + displayName + niche", async () => {
    (prisma.project.findUniqueOrThrow as any).mockResolvedValue({
      kind: "PODCASTER",
      displayName: "TestCast",
      niche: "tech",
      city: "Milano",
      bio: null,
      user: { timezone: "Europe/Rome" },
      socialAccounts: [],
      campaigns: [],
    });
    const ctx = await buildContext("p1");
    expect(ctx.project.kind).toBe("PODCASTER");
    expect(ctx.project.displayName).toBe("TestCast");
    expect(ctx.project.niche).toBe("tech");
    expect(ctx.timezone).toBe("Europe/Rome");
  });
});
```

```bash
pnpm vitest run lib/ai/context-builder.test.ts
```

Atteso: PASS.

- [ ] **Step 13.3: Commit**

```bash
git add lib/ai/context-builder.ts lib/ai/context-builder.test.ts
git commit -m "refactor(M16): context-builder accetta projectId + kind nel payload"
```

---

### Task 14: lib/ai/prompts.ts kind-aware block

**Files:**
- Modify: `lib/ai/prompts.ts`

- [ ] **Step 14.1: Aggiungi blocco**

Trova la sezione del system prompt cachato e aggiungi PRIMA del closing del cache block:

```
---

KIND-SPECIFIC GUIDELINES

Adatta i suggerimenti al "kind" indicato in input.project.kind.

- ARTIST: pensa al ciclo release musicale (snippet → preview → drop → after).
  Format ottimali: Reel 15-30s, snippet TikTok con hook musicale,
  IG carousel cover art / lyric. KPI principali: stream Spotify,
  follower IG/TikTok, save Reel.

- YOUTUBER: pensa al funnel video (trailer/teaser → upload →
  community tab → short di estratti). Format ottimali: Short 60s,
  anteprime, thumbnail-first. KPI: iscritti, retention %, watch time.

- INFLUENCER: pensa a lifestyle/storytelling continuativo.
  Format ottimali: Reel storyline, carousel-valore, story BTS.
  KPI: engagement rate, salvataggi, condivisioni.

- DIVULGATORE: pensa autorità + accessibilità (educational hook).
  Format ottimali: video lungo + clip estratte, carousel didattici,
  thread. KPI: completion rate, salvataggi, citazioni.

- PODCASTER: pensa al ciclo episodio (annuncio → drop → clip estratte
  → guest cross-promo). Format ottimali: audiogram, clip 30-60s,
  carousel "5 takeaway". KPI: download, completion, condivisioni clip.

- BRAND: pensa funnel awareness → consideration → conversione (no spam
  diretto). Format ottimali: storytelling prodotto, UGC, case study.
  KPI: reach qualificato, click out, lead form.

In ogni suggerimento, motiva il rationale citando il kind.
```

Mantieni `cache_control: { type: "ephemeral" }` sul blocco system completo.

- [ ] **Step 14.2: Verifica build**

```bash
pnpm build 2>&1 | grep -i "prompts.ts" || echo "ok prompts.ts"
```

Atteso: nessun errore.

- [ ] **Step 14.3: Commit**

```bash
git add lib/ai/prompts.ts
git commit -m "feat(M16): prompts kind-aware block (cachato per tutti i kind)"
```

---

### Task 15: lib/ai/recommender.ts + lib/ai/feedback.ts (Project param)

**Files:**
- Modify: `lib/ai/recommender.ts`
- Modify: `lib/ai/feedback.ts`

- [ ] **Step 15.1: Aggiorna firme**

In `lib/ai/recommender.ts`:
- Sostituisci `generateSuggestions(userId: string)` → `generateSuggestions(project: Project)`
- Internamente: `buildContext(project.id)` (già aggiornato Task 13)
- Salva `Suggestion` con `projectId: project.id` invece di `userId`

In `lib/ai/feedback.ts`:
- Sostituisci `generateDailyFeedback(userId, ...)` → `generateDailyFeedback(project: Project, ...)`
- Internamente: query metriche/post via `project.id`
- Restituisci `{ headline, body, postsCount, generatedBy }` (no `userId`)

- [ ] **Step 15.2: Verifica typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "lib/ai/(recommender|feedback)"
```

Atteso: nessun errore.

- [ ] **Step 15.3: Commit**

```bash
git add lib/ai/recommender.ts lib/ai/feedback.ts
git commit -m "refactor(M16): recommender/feedback accettano Project"
```

---

### Task 16: lib/ai/marketing/* + lib/ai/brand/* kind-aware

**Files:**
- Modify: `lib/ai/marketing/persona.ts`
- Modify: `lib/ai/marketing/campaign.ts`
- Modify: `lib/ai/marketing/score.ts`
- Modify: `lib/ai/brand/identity.ts`
- Modify: `lib/ai/brand/cover-brief.ts`
- Modify: `lib/ai/brand/stage-names.ts`

- [ ] **Step 16.1: Pattern**

Per ogni funzione: aggiungi `kind: CreatorKind` (o accetta `Project` direttamente). Inietta `getKindLabels(kind)` nel prompt. Per `campaign.ts`: aggiungi `availableTypes: CampaignType[] = KIND_CAMPAIGN_TYPES[kind]` e inietta nel system message ("Scegli un tipo da: ${availableTypes.join(', ')}").

Per `stage-names.ts`: cambia testo prompt a `"Genera ${n} idee di ${labels.creator === 'artista' ? 'nome d\\'arte' : 'nome canale/handle'} per..."`. Mantieni nome funzione (rinomina file → file-rename in Task UI separato).

`score.ts` (NeuroScore): NESSUN cambio funzionale richiesto — segnali brain-predictive sono universali. Solo aggiungi `kind` al contesto AI (info passiva).

- [ ] **Step 16.2: Test marketing types (esistente)**

```bash
pnpm vitest run lib/ai/marketing/types.test.ts
```

Atteso: PASS (test esistenti M12 sopravvivono).

- [ ] **Step 16.3: Commit**

```bash
git add lib/ai/marketing lib/ai/brand
git commit -m "feat(M16): marketing/brand prompts kind-aware (persona, campaign types, brand)"
```

---

## Phase E — Cron + email + rate-limit

### Task 17: lib/email.ts sendAggregatedDailyFeedbackEmail (TDD)

**Files:**
- Modify: `lib/email.ts`
- Modify: `lib/email.test.ts`

- [ ] **Step 17.1: Scrivi test**

In `lib/email.test.ts` aggiungi:

```ts
import { sendAggregatedDailyFeedbackEmail } from "./email";

describe("sendAggregatedDailyFeedbackEmail", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("skipped no_api_key se RESEND_API_KEY mancante", async () => {
    const result = await sendAggregatedDailyFeedbackEmail("user@x.io", {
      forDate: new Date("2026-04-27"),
      appUrl: "https://x.io",
      projects: [
        { displayName: "P1", kind: "ARTIST", headline: "h", body: "b", postsCount: 1 },
      ],
    });
    expect(result.skipped).toBe("no_api_key");
  });
});
```

- [ ] **Step 17.2: Run, verifica fail**

```bash
pnpm vitest run lib/email.test.ts
```

Atteso: FAIL (funzione non esiste).

- [ ] **Step 17.3: Implementa**

In `lib/email.ts` aggiungi:

```ts
export interface AggregatedDailyFeedbackPayload {
  forDate: Date;
  appUrl: string;
  projects: Array<{
    displayName: string;
    kind: string;
    headline: string;
    body: string;
    postsCount: number;
  }>;
}

export async function sendAggregatedDailyFeedbackEmail(
  to: string,
  payload: AggregatedDailyFeedbackPayload,
): Promise<SendResult> {
  const dateLabel = payload.forDate.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
  });
  const subject = `[SMM Studio] Feedback ${dateLabel} — ${payload.projects.length} ${payload.projects.length === 1 ? "progetto" : "progetti"}`;

  const sections = payload.projects
    .map(
      (p) => `
    <div style="border-top: 1px solid #eee; padding-top: 18px; margin-top: 18px;">
      <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin: 0;">
        ${escapeHtml(p.kind)} · ${p.postsCount} post
      </p>
      <h2 style="font-size: 17px; margin: 6px 0 4px;">${escapeHtml(p.displayName)}</h2>
      <p style="font-size: 14px; color: #555; margin: 0 0 8px;">${escapeHtml(p.headline)}</p>
      <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap; color: #222;">
        ${escapeHtml(p.body)}
      </div>
    </div>
  `,
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <p style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.04em;">
        I tuoi progetti — ${dateLabel}
      </p>
      <h1 style="font-size: 22px; margin: 6px 0 4px;">Feedback giornaliero</h1>
      ${sections}
      <p style="margin-top: 28px;">
        <a href="${payload.appUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          Apri SMM Studio
        </a>
      </p>
      <p style="font-size: 11px; color: #999; margin-top: 32px;">
        Disattiva l'email per un singolo progetto da Impostazioni progetto.
      </p>
    </div>
  `;
  const text = payload.projects
    .map((p) => `## ${p.displayName} (${p.kind})\n${p.headline}\n\n${p.body}`)
    .join("\n\n---\n\n");

  return sendEmail({ to, subject, html, text });
}
```

- [ ] **Step 17.4: Run test, verifica pass**

```bash
pnpm vitest run lib/email.test.ts
```

Atteso: PASS.

- [ ] **Step 17.5: Commit**

```bash
git add lib/email.ts lib/email.test.ts
git commit -m "feat(M16): sendAggregatedDailyFeedbackEmail (1 mail/giorno, N sezioni)"
```

---

### Task 18: Refactor cron daily-sync

**Files:**
- Modify: `app/api/cron/daily-sync/route.ts`

- [ ] **Step 18.1: Riscrivi loop**

```ts
// app/api/cron/daily-sync/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncProjectAccounts } from "@/lib/sync";
import { evaluateProjectGoals } from "@/lib/goals";

function authorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) return false;
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("forbidden", { status: 403 });

  const projects = await prisma.project.findMany({
    select: { id: true, userId: true, displayName: true },
  });

  const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];

  for (const project of projects) {
    try {
      await syncProjectAccounts(project.id);
      try {
        await evaluateProjectGoals(project.id);
      } catch (err) {
        console.warn(`goals eval failed for ${project.id}`, err);
      }
      results.push({ projectId: project.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`sync failed for ${project.id}: ${msg}`);
      results.push({ projectId: project.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({ ok: true, count: projects.length, results });
}
```

In `lib/sync.ts`: rinomina/aggiungi `syncProjectAccounts(projectId: string)` che fa il vecchio lavoro di `syncUserAccounts` ma su `socialAccount.projectId`.

In `lib/goals.ts`: rinomina/aggiungi `evaluateProjectGoals(projectId: string)`.

- [ ] **Step 18.2: Commit**

```bash
git add app/api/cron/daily-sync/route.ts lib/sync.ts lib/goals.ts
git commit -m "refactor(M16): cron daily-sync itera Project"
```

---

### Task 19: Refactor cron evening-feedback (email aggregata)

**Files:**
- Modify: `app/api/cron/evening-feedback/route.ts`
- Create: `lib/cron-helpers.ts`
- Create: `lib/cron-helpers.test.ts`

- [ ] **Step 19.1: Scrivi test cron-helpers**

```ts
// lib/cron-helpers.test.ts
import { describe, it, expect } from "vitest";
import { groupFeedbackByUser } from "./cron-helpers";

describe("groupFeedbackByUser", () => {
  it("aggrega feedback di N progetti in 1 entry per utente", () => {
    const items = [
      { userId: "u1", project: { id: "p1", displayName: "A", kind: "ARTIST" }, feedback: { headline: "ha", body: "ba", postsCount: 1 } },
      { userId: "u1", project: { id: "p2", displayName: "B", kind: "PODCASTER" }, feedback: { headline: "hb", body: "bb", postsCount: 0 } },
      { userId: "u2", project: { id: "p3", displayName: "C", kind: "BRAND" }, feedback: { headline: "hc", body: "bc", postsCount: 2 } },
    ];
    const grouped = groupFeedbackByUser(items);
    expect(grouped).toHaveLength(2);
    const u1 = grouped.find((g) => g.userId === "u1")!;
    expect(u1.projects).toHaveLength(2);
    expect(u1.projects[0].displayName).toBe("A");
  });

  it("ritorna [] su input vuoto", () => {
    expect(groupFeedbackByUser([])).toEqual([]);
  });
});
```

- [ ] **Step 19.2: Run, verifica fail**

```bash
pnpm vitest run lib/cron-helpers.test.ts
```

Atteso: FAIL.

- [ ] **Step 19.3: Implementa cron-helpers**

```ts
// lib/cron-helpers.ts
export interface FeedbackItem {
  userId: string;
  project: { id: string; displayName: string; kind: string };
  feedback: { headline: string; body: string; postsCount: number };
}

export interface GroupedFeedback {
  userId: string;
  projects: Array<{
    displayName: string;
    kind: string;
    headline: string;
    body: string;
    postsCount: number;
  }>;
}

export function groupFeedbackByUser(items: FeedbackItem[]): GroupedFeedback[] {
  const map = new Map<string, GroupedFeedback>();
  for (const item of items) {
    let group = map.get(item.userId);
    if (!group) {
      group = { userId: item.userId, projects: [] };
      map.set(item.userId, group);
    }
    group.projects.push({
      displayName: item.project.displayName,
      kind: item.project.kind,
      headline: item.feedback.headline,
      body: item.feedback.body,
      postsCount: item.feedback.postsCount,
    });
  }
  return Array.from(map.values());
}
```

- [ ] **Step 19.4: Run test, verifica pass**

```bash
pnpm vitest run lib/cron-helpers.test.ts
```

Atteso: PASS.

- [ ] **Step 19.5: Riscrivi cron evening-feedback**

```ts
// app/api/cron/evening-feedback/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyFeedback } from "@/lib/ai/feedback";
import { sendAggregatedDailyFeedbackEmail } from "@/lib/email";
import { groupFeedbackByUser, type FeedbackItem } from "@/lib/cron-helpers";

function authorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("forbidden", { status: 403 });

  const projects = await prisma.project.findMany({
    where: { emailFeedbackEnabled: true },
    include: { user: { select: { id: true, email: true } } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: FeedbackItem[] = [];
  for (const project of projects) {
    try {
      const feedback = await generateDailyFeedback(project, today);
      await prisma.dailyFeedback.upsert({
        where: { projectId_forDate: { projectId: project.id, forDate: today } },
        create: {
          projectId: project.id,
          forDate: today,
          headline: feedback.headline,
          body: feedback.body,
          postsCount: feedback.postsCount,
          generatedBy: feedback.generatedBy,
        },
        update: {
          headline: feedback.headline,
          body: feedback.body,
          postsCount: feedback.postsCount,
          generatedBy: feedback.generatedBy,
        },
      });
      items.push({
        userId: project.userId,
        project: { id: project.id, displayName: project.displayName, kind: project.kind },
        feedback,
      });
    } catch (err) {
      console.error(`feedback failed for ${project.id}`, err);
    }
  }

  const grouped = groupFeedbackByUser(items);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";

  for (const group of grouped) {
    const user = projects.find((p) => p.userId === group.userId)?.user;
    if (!user?.email) continue;
    await sendAggregatedDailyFeedbackEmail(user.email, {
      forDate: today,
      appUrl,
      projects: group.projects,
    });
  }

  return NextResponse.json({
    ok: true,
    projectsProcessed: items.length,
    emailsSent: grouped.length,
  });
}
```

- [ ] **Step 19.6: Commit**

```bash
git add lib/cron-helpers.ts lib/cron-helpers.test.ts app/api/cron/evening-feedback/route.ts
git commit -m "refactor(M16): cron evening-feedback aggrega per user → 1 email/giorno"
```

---

### Task 20: Refactor lib/rate-limit.ts (chiave composita)

**Files:**
- Modify: `lib/rate-limit.ts`
- Modify: `lib/rate-limit.test.ts`

- [ ] **Step 20.1: Aggiorna firma**

Cambia `checkRateLimit(userId, limitName)` → `checkRateLimit(userId, projectId, limitName)`. Chiave interna: `${userId}:${projectId}:${limitName}`. Aggiungi anche limite globale `${userId}:*:GLOBAL` (es. 50/h).

```ts
export interface RateLimitInput {
  userId: string;
  projectId: string;
  limitName: keyof typeof LIMITS;
}

export function checkRateLimit(input: RateLimitInput): { allowed: boolean; resetAt?: number } {
  const { userId, projectId, limitName } = input;
  // ... usa key = `${userId}:${projectId}:${limitName}`
  // ... applica anche limite globale `${userId}:*:GLOBAL`
}

export const LIMITS = {
  SUGGESTIONS_GENERATE: { count: 10, windowMs: 60 * 60 * 1000 },
  MARKETING_PERSONA:    { count: 5,  windowMs: 60 * 60 * 1000 },
  // ... esistenti
  GLOBAL:               { count: 50, windowMs: 60 * 60 * 1000 },
};
```

- [ ] **Step 20.2: Aggiungi test**

```ts
it("checkRateLimit usa chiave composita projectId", () => {
  const r1 = checkRateLimit({ userId: "u1", projectId: "p1", limitName: "SUGGESTIONS_GENERATE" });
  expect(r1.allowed).toBe(true);
  // u1:p2 deve avere quota indipendente
  const r2 = checkRateLimit({ userId: "u1", projectId: "p2", limitName: "SUGGESTIONS_GENERATE" });
  expect(r2.allowed).toBe(true);
});

it("limite globale per user blocca cross-progetto", () => {
  // simula 50 chiamate distribuite
  for (let i = 0; i < 50; i++) {
    checkRateLimit({ userId: "u_global", projectId: `p${i}`, limitName: "SUGGESTIONS_GENERATE" });
  }
  const r = checkRateLimit({ userId: "u_global", projectId: "p_new", limitName: "SUGGESTIONS_GENERATE" });
  expect(r.allowed).toBe(false);
});
```

- [ ] **Step 20.3: Aggiorna chiamanti**

In tutte le 7 routes che chiamano Anthropic (suggestions/generate, marketing/*, brand/*), aggiorna chiamata a `checkRateLimit({ userId: project.userId, projectId: project.id, limitName: "..." })`.

- [ ] **Step 20.4: Run test**

```bash
pnpm vitest run lib/rate-limit.test.ts
```

Atteso: PASS.

- [ ] **Step 20.5: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts app/api
git commit -m "refactor(M16): rate-limit chiave composita userId:projectId + cap globale user"
```

---

## Phase F — UI

### Task 21: Componenti utility (ProjectKindBadge + CreateProjectModal + ProjectSettingsForm)

**Files:**
- Create: `components/ProjectKindBadge.tsx`
- Create: `components/CreateProjectModal.tsx`
- Create: `components/ProjectSettingsForm.tsx`

- [ ] **Step 21.1: ProjectKindBadge**

```tsx
// components/ProjectKindBadge.tsx
import type { CreatorKind } from "@prisma/client";
import { KIND_DISPLAY } from "@/lib/kind-labels";
import { clsx } from "clsx";

const COLORS: Record<CreatorKind, string> = {
  ARTIST:      "bg-violet-100 text-violet-700",
  YOUTUBER:    "bg-red-100 text-red-700",
  INFLUENCER:  "bg-pink-100 text-pink-700",
  DIVULGATORE: "bg-blue-100 text-blue-700",
  PODCASTER:   "bg-amber-100 text-amber-700",
  BRAND:       "bg-emerald-100 text-emerald-700",
};

export function ProjectKindBadge({ kind, className }: { kind: CreatorKind; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        COLORS[kind],
        className,
      )}
    >
      {KIND_DISPLAY[kind]}
    </span>
  );
}
```

- [ ] **Step 21.2: CreateProjectModal**

```tsx
// components/CreateProjectModal.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreatorKind } from "@prisma/client";
import { KIND_DISPLAY } from "@/lib/kind-labels";

export function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<CreatorKind>("ARTIST");
  const [displayName, setDisplayName] = useState("");
  const [niche, setNiche] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, displayName: displayName.trim(), niche: niche.trim() || null }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error === "max_projects_reached") {
        setError(`Limite di ${j.limit} progetti raggiunto.`);
      } else {
        setError(j.error || "Errore creazione progetto");
      }
      setSubmitting(false);
      return;
    }
    const { project } = await res.json();
    await fetch(`/api/projects/${project.id}/activate`, { method: "POST" });
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Nuovo progetto</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CreatorKind)}
              className="w-full rounded border border-gray-300 p-2"
            >
              {Object.values(CreatorKind).map((k) => (
                <option key={k} value={k}>
                  {KIND_DISPLAY[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome progetto</span>
            <input
              type="text"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border border-gray-300 p-2"
              placeholder="es. Mio progetto musicale"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nicchia (opzionale)</span>
            <input
              type="text"
              maxLength={80}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded border border-gray-300 p-2"
              placeholder="es. trap, tech reviews, history"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm">
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName.trim()}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Creo…" : "Crea progetto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 21.3: ProjectSettingsForm**

```tsx
// components/ProjectSettingsForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";

export function ProjectSettingsForm({ project }: { project: Project }) {
  const [displayName, setDisplayName] = useState(project.displayName);
  const [niche, setNiche] = useState(project.niche || "");
  const [city, setCity] = useState(project.city || "");
  const [bio, setBio] = useState(project.bio || "");
  const [emailEnabled, setEmailEnabled] = useState(project.emailFeedbackEnabled);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim(),
        niche: niche.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        emailFeedbackEnabled: emailEnabled,
      }),
    });
    setSaving(false);
    router.refresh();
  }

  async function destroy() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.refresh();
    router.push("/progetti");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nicchia</span>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Città</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Bio</span>
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
          />
          <span className="text-sm">Includi questo progetto nell'email feedback giornaliero</span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
      </form>

      <div className="rounded border border-red-300 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-800">Zona pericolosa</h3>
        <p className="mt-1 text-sm text-red-700">
          Eliminare il progetto cancella TUTTI i dati associati (account social, suggerimenti, draft, brand,
          campagne, obiettivi). Operazione irreversibile.
        </p>
        <input
          type="text"
          placeholder="Digita DELETE per confermare"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-2 w-full rounded border border-red-300 p-2 text-sm"
        />
        <button
          type="button"
          onClick={destroy}
          disabled={confirmText !== "DELETE" || deleting}
          className="mt-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {deleting ? "Elimino…" : "Elimina progetto"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 21.4: Commit**

```bash
git add components/ProjectKindBadge.tsx components/CreateProjectModal.tsx components/ProjectSettingsForm.tsx
git commit -m "feat(M16): componenti ProjectKindBadge, CreateProjectModal, ProjectSettingsForm"
```

---

### Task 22: ProjectSwitcher

**Files:**
- Create: `components/ProjectSwitcher.tsx`

- [ ] **Step 22.1: Implementa**

```tsx
// components/ProjectSwitcher.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Check } from "lucide-react";
import type { Project } from "@prisma/client";
import { ProjectKindBadge } from "./ProjectKindBadge";
import { CreateProjectModal } from "./CreateProjectModal";

export function ProjectSwitcher({
  active,
  projects,
}: {
  active: Project;
  projects: Pick<Project, "id" | "displayName" | "kind">[];
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function activate(id: string) {
    if (id === active.id) {
      setOpen(false);
      return;
    }
    await fetch(`/api/projects/${id}/activate`, { method: "POST" });
    router.refresh();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{active.displayName}</div>
          <ProjectKindBadge kind={active.kind} className="mt-0.5" />
        </div>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-64 overflow-auto py-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => activate(p.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{p.displayName}</div>
                    <ProjectKindBadge kind={p.kind} className="mt-0.5" />
                  </div>
                  {p.id === active.id && <Check className="h-4 w-4 text-violet-600" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50"
          >
            <Plus className="h-4 w-4" />
            Nuovo progetto
          </button>
        </div>
      )}

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}
```

- [ ] **Step 22.2: Commit**

```bash
git add components/ProjectSwitcher.tsx
git commit -m "feat(M16): ProjectSwitcher dropdown sidebar"
```

---

### Task 23: Pagina /progetti

**Files:**
- Create: `app/(app)/progetti/page.tsx`

- [ ] **Step 23.1: Implementa**

```tsx
// app/(app)/progetti/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveProject } from "@/lib/active-project";
import { ProjectKindBadge } from "@/components/ProjectKindBadge";
import { ProjectSettingsForm } from "@/components/ProjectSettingsForm";
import { canCreateProject, MAX_PROJECTS_PER_USER } from "@/lib/projects";
import Link from "next/link";

export default async function ProgettiPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; create?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const params = await searchParams;
  const allowCreate = await canCreateProject(session.user.id);

  let selected = projects.find((p) => p.id === params.p);
  if (!selected) {
    selected = (await getActiveProject()) || projects[0];
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Progetti</h1>
        <p className="text-xs text-gray-500">
          {projects.length} / {MAX_PROJECTS_PER_USER}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/progetti?p=${p.id}`}
                  className={`block rounded border p-3 ${
                    selected?.id === p.id ? "border-violet-300 bg-violet-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="text-sm font-medium">{p.displayName}</div>
                  <ProjectKindBadge kind={p.kind} className="mt-1" />
                </Link>
              </li>
            ))}
          </ul>
          {!allowCreate && (
            <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
              Hai raggiunto il limite di {MAX_PROJECTS_PER_USER} progetti.
            </p>
          )}
        </aside>

        <main>
          {selected ? (
            <ProjectSettingsForm project={selected} />
          ) : (
            <p className="text-sm text-gray-500">Crea il tuo primo progetto dal pulsante in sidebar.</p>
          )}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 23.2: Commit**

```bash
git add app/\(app\)/progetti/page.tsx
git commit -m "feat(M16): pagina /progetti con lista + impostazioni"
```

---

### Task 24: SidebarNav refactor

**Files:**
- Modify: `components/SidebarNav.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 24.1: Aggiorna SidebarNav per accettare projects**

In `SidebarNav.tsx`:
1. Aggiungi prop `activeProject: Project` e `projects: Pick<Project, "id" | "displayName" | "kind">[]`
2. Rendi `<ProjectSwitcher active={activeProject} projects={projects} />` in cima alla sidebar (prima del menu)
3. Aggiungi voce menu nuova: `{ href: "/progetti", label: "Progetti", icon: FolderKanban }` (importa da `lucide-react`)
4. Mobile drawer: stesso `<ProjectSwitcher />` in cima

- [ ] **Step 24.2: Aggiorna layout**

In `app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveProject } from "@/lib/active-project";
import { SidebarNav } from "@/components/SidebarNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, kind: true },
    orderBy: { createdAt: "asc" },
  });

  if (projects.length === 0) redirect("/progetti?create=1");

  const active = (await getActiveProject()) || (await prisma.project.findUnique({ where: { id: projects[0].id } }))!;

  return (
    <div className="flex min-h-screen">
      <SidebarNav activeProject={active} projects={projects} user={session.user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 24.3: Commit**

```bash
git add components/SidebarNav.tsx app/\(app\)/layout.tsx
git commit -m "feat(M16): SidebarNav con ProjectSwitcher + voce Progetti"
```

---

### Task 25: Refactor pagine esistenti per usare project attivo

**Files:**
- Modify: `app/(app)/page.tsx` (Dashboard)
- Modify: `app/(app)/calendario/page.tsx`
- Modify: `app/(app)/suggerimenti/page.tsx`
- Modify: `app/(app)/bozze/page.tsx`
- Modify: `app/(app)/bozze/[id]/page.tsx`
- Modify: `app/(app)/marketing/page.tsx`
- Modify: `app/(app)/marketing/campagna/page.tsx`
- Modify: `app/(app)/marketing/campagna/nuova/page.tsx`
- Modify: `app/(app)/marketing/persona/page.tsx`
- Modify: `app/(app)/brand/identita/page.tsx`
- Modify: `app/(app)/brand/nome/page.tsx`
- Modify: `app/(app)/obiettivi/page.tsx`
- Modify: `app/(app)/analytics/[platform]/page.tsx`
- Modify: `app/(app)/impostazioni/page.tsx`
- Delete: `app/(app)/impostazioni/profilo/page.tsx` (sostituita da /progetti)

- [ ] **Step 25.1: Pattern**

In ogni page server component:

```tsx
// PRIMA
const session = await auth();
const profile = await prisma.artistProfile.findUnique({ where: { userId: session.user.id } });
const drafts = await prisma.draft.findMany({ where: { userId: session.user.id } });

// DOPO
import { getActiveProject } from "@/lib/active-project";
import { redirect } from "next/navigation";

const project = await getActiveProject();
if (!project) redirect("/progetti?create=1");
const drafts = await prisma.draft.findMany({ where: { projectId: project.id } });
```

Per le pagine che mostravano `profile.stageName`, `profile.genre`, ecc., usa `project.displayName`, `project.niche`. Per pagine che mostrano label "artista", usa `getKindLabels(project.kind).creator` (importa da `@/lib/kind-labels`).

`/analytics/[platform]/page.tsx`: filtro `socialAccount` per `projectId` invece di `userId`.

`/impostazioni/page.tsx`: rimuovi sezione "profilo artista" (ora in /progetti). Lascia solo timezone, account social (filtrati per projectId).

`/impostazioni/profilo/page.tsx`: elimina file (sostituita da `/progetti`).

- [ ] **Step 25.2: Verifica build**

```bash
pnpm build
```

Atteso: build verde.

- [ ] **Step 25.3: Commit**

```bash
git add app/\(app\)
git commit -m "refactor(M16): pagine app filtrano dati per project attivo"
```

---

## Phase G — Final

### Task 26: Verifica completa + PR

**Files:** N/A (solo verifica)

- [ ] **Step 26.1: Typecheck pulito**

```bash
pnpm typecheck
```

Atteso: 0 errori.

- [ ] **Step 26.2: Test suite verde**

```bash
pnpm test
```

Atteso: tutti i test pass (target ~70 test totali). Se qualche test esistente rompe per via di firme cambiate, aggiorna inline e ri-esegui fino a verde.

- [ ] **Step 26.3: Build verde**

```bash
pnpm build
```

Atteso: `next build` completa senza errori, prisma generate inclusa.

- [ ] **Step 26.4: Lint pulito**

```bash
pnpm lint
```

Atteso: 0 warning critici.

- [ ] **Step 26.5: Smoke test manuale dev server**

```bash
pnpm dev
```

Apri `http://localhost:3000`, login, verifica:
- Redirect a `/progetti?create=1` se nessun progetto
- Crea progetto kind=ARTIST → diventa attivo
- Crea secondo progetto kind=PODCASTER → switcher mostra entrambi
- Dashboard mostra dati progetto attivo (vuoto, OK)
- Switcher → cambia progetto → router refresh
- Goto /progetti → modifica nome → salva → switcher aggiornato
- Goto /progetti → DELETE con confirm "DELETE" → progetto sparisce
- Tentativo creare 6° progetto da non-allowlist email → toast "max progetti raggiunto"

- [ ] **Step 26.6: Aggiorna README**

In `README.md` aggiungi sezione:

```markdown
## Multi-progetto (M16)

Un account utente può gestire fino a **5 progetti** indipendenti (cap rimovibile via `EMAIL_ALLOWLIST`). Ogni progetto è di tipo **kind**:

- `ARTIST` — musicista/producer
- `YOUTUBER` — long-form video
- `INFLUENCER` — lifestyle/fashion
- `DIVULGATORE` — educator
- `PODCASTER` — podcast audio
- `BRAND` — azienda

Il progetto attivo è memorizzato in cookie HMAC-firmato (`active_project_id`).
Switch dal dropdown in cima alla sidebar. AI prompts adattano i suggerimenti
al kind del progetto.
```

- [ ] **Step 26.7: Push branch + PR**

```bash
git push -u origin m16/multi-project-design
gh pr create --title "M16: multi-project (Project model + CreatorKind + switcher)" --body "$(cat <<'EOF'
## Summary
- Refactor schema `1 user = 1 artista` → `1 user = N progetti`
- `ArtistProfile` eliminato, rimpiazzato da `Project` con `CreatorKind` enum (ARTIST/YOUTUBER/INFLUENCER/DIVULGATORE/PODCASTER/BRAND)
- 10 model dominio passano da `userId` a `projectId`
- ProjectSwitcher in sidebar + cookie HMAC `active_project_id`
- Cap 5 progetti/utente con override `EMAIL_ALLOWLIST`
- AI prompts kind-aware (branching nel system prompt cachato)
- Cron iterano `Project`; email feedback aggregata 1/giorno
- Rate limit chiave composita `userId:projectId` + cap globale per user

## Test plan
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` verde (~70 test)
- [ ] `pnpm build` clean
- [ ] Smoke manuale: crea/switcha/elimina progetti, verifica filtro dati
- [ ] Verifica cron daily-sync con 2+ progetti loggati
- [ ] Verifica email aggregata mostra N sezioni progetti

Spec: `docs/superpowers/specs/2026-04-27-m16-multi-project-design.md`
Plan: `docs/superpowers/plans/2026-04-27-m16-multi-project.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Recap Tasks

| # | Phase | Task | Test? |
|---|---|---|---|
| 1 | A | Schema + migration | — |
| 2 | A | lib/kind-labels.ts | TDD |
| 3 | A | lib/projects.ts (cap) | TDD |
| 4 | A | active-project HMAC | TDD |
| 5 | A | active-project get/set/with | TDD |
| 6 | B | API GET+POST /api/projects | — |
| 7 | B | API PATCH+DELETE /api/projects/[id] | — |
| 8 | B | API POST .../activate | — |
| 9 | C | Refactor suggestions+drafts | — |
| 10 | C | Refactor marketing+brand | — |
| 11 | C | Refactor goals+export | esteso |
| 12 | C | Refactor metrics+connect+spotify | TDD OAuth state |
| 13 | D | context-builder Project param | TDD |
| 14 | D | prompts.ts kind block | — |
| 15 | D | recommender+feedback Project param | — |
| 16 | D | marketing+brand prompts kind-aware | — |
| 17 | E | sendAggregatedDailyFeedbackEmail | TDD |
| 18 | E | cron daily-sync loop projects | — |
| 19 | E | cron evening-feedback aggregata | TDD helpers |
| 20 | E | rate-limit chiave composita | TDD |
| 21 | F | UI: badge + modal + settings form | — |
| 22 | F | UI: ProjectSwitcher | — |
| 23 | F | UI: pagina /progetti | — |
| 24 | F | UI: SidebarNav + layout | — |
| 25 | F | UI: refactor pagine esistenti | — |
| 26 | G | Verifica + README + PR | — |

**Target test coverage:** ~70 test totali (50 attuali + ~20 nuovi).

**Frequenza commit:** ≥1 commit per task (alcuni task hanno commit intermedio dopo TDD).

**Dipendenze ordine:**

```
A (schema)
├── B (project CRUD API) — indipendente da AI/cron
├── D (AI helpers Project param) — indipendente da API routes
│   ├── C (refactor API esistenti) — chiama AI helpers, deve venire DOPO D
│   └── E (cron + email) — usa AI feedback, deve venire DOPO D
└── F (UI) — usa B (CRUD) + helpers Phase A
G (verifica) — ultimo
```

**Ordine consigliato esecuzione:** `A → B → D → C → E → F → G`

Esecuzione con subagent-driven: dispatcher può parallelizzare B+D dopo A, poi C+E in parallelo dopo D, poi F dopo B+C.

Esecuzione inline: segui ordine consigliato. Typecheck rosso atteso dopo Task 1 fino a Task 26 — non bloccare commit intermedi per quello.
