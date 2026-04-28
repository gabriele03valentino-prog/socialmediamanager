# M17 — Onboarding Wizard v2 Design

**Date:** 2026-04-27
**Status:** Approved (autonomous decisions per user "vai in modalità auto")
**Scope:** Riduce time-to-first-suggestion per nuovo utente da N minuti a <2 minuti via wizard guidato. Replace `/progetti?create=1` modal con wizard full-page multi-step.

## Context

M16 introduce multi-progetto. Quando user senza progetti accede a qualsiasi `/(app)/*`, layout redirect a `/progetti?create=1` che apre `CreateProjectModal` (form basico). UX problemi:
- Modal cramped, 3 campi, no preview kind
- Nessuna guida su next steps (devi sapere già cosa fare)
- Time-to-first-suggestion alto: crea progetto → vai dashboard → clicca "Connetti" → torna sidebar → clicca "Suggerimenti" → "Genera"

**Obiettivo M17:** wizard full-page che porta utente da zero a primo piano settimanale generato in flusso lineare guidato.

## Decisioni autonome

| Topic | Scelta | Razionale |
|---|---|---|
| Layout | Full-page route `/onboarding` | Più spazio, focus, no modal zoom-in. Modal CreateProjectModal resta per "+ Nuovo progetto" da sidebar |
| Step count | 4 step | Kind → Identità → Account social (skip OK) → Genera piano (auto). Sotto 5 = poco abbandono |
| Kind selection | Card grid (6 card colorate con icona + descrizione + esempi) | Visualizza scelta meglio di dropdown |
| Mandatory data | Solo kind + displayName | Niche/city/bio = optional in step 2 |
| Social connect | Optional step skippable | OAuth richiede setup app. Skip permesso → suggerimenti generati su contesto vuoto + CTA "Connetti per dati reali" |
| Auto-generate | SI, ultimo step → POST `/api/suggestions/generate` automatico se `ANTHROPIC_API_KEY` set | Time-to-first-value vicino a zero |
| Skip wizard? | Tasto "Salta wizard" su step 1 → fallback `CreateProjectModal` | Utenti esperti |
| Replay wizard? | URL `/onboarding` accessibile sempre | Anche per N-esimo progetto |

## Architecture

### Route flow

```
User new (0 projects)
  → /(app)/* layout redirect → /onboarding (replace /progetti?create=1)

Wizard /onboarding (4 step state in URL `?step=N`)
  Step 1: Tipo creator        → kind in localStorage o param
  Step 2: Identità (name+...) → POST /api/projects → set active cookie
  Step 3: Connetti social     → list connect buttons OR Skip
  Step 4: Genera primo piano  → auto POST /api/suggestions/generate

Final: redirect /suggerimenti con primo piano in evidenza
```

### File structure

```
app/(app)/onboarding/
  page.tsx                 # Server component, richiede auth, decide step iniziale
  layout.tsx               # No sidebar (full-screen wizard)

components/onboarding/
  WizardShell.tsx          # Step indicator + nav buttons + container
  StepKindPicker.tsx       # Card grid 6 kind
  StepIdentity.tsx         # Form displayName + niche + city + bio
  StepSocialConnect.tsx    # Lista platform cards + Skip
  StepGeneratePlan.tsx     # Auto-call generate, loading state, link to /suggerimenti

components/KindCard.tsx    # Single card pickable, riusabile
```

### Wizard state machine

Client-side state via URL `?step=1..4`. Avanza/indietro tramite `router.push`. Persistenza tra step:
- Step 1 sceglie kind → salva in `sessionStorage` (key `m17_wizard_kind`)
- Step 2 invia POST `/api/projects` con kind+identity → server set cookie active → router.push step 3
- Step 3 lista platform → click platform → redirect a `/api/connect/[platform]/start` con `?next=/onboarding?step=4`. Skip → step 4
- Step 4 mounted → `useEffect` POST `/api/suggestions/generate` (rate-limit aware), poi redirect `/suggerimenti`

### Layout-level redirect change

`app/(app)/layout.tsx`:
- Cambia `redirect("/progetti?create=1")` → `redirect("/onboarding")` quando 0 progetti.
- `/progetti?create=1` modal resta come secondario (utente con 1+ progetti aggiunge un altro).

`app/(app)/onboarding/layout.tsx`:
- No sidebar. Brand header + content centrato. Mantiene auth check (redirect /login).

## Components dettaglio

### WizardShell

```tsx
interface WizardShellProps {
  step: 1 | 2 | 3 | 4;
  totalSteps: 4;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}
```

Mostra step indicator (1—2—3—4 dots), titolo step corrente, container con children, footer "Indietro" + "Avanti" (controllo da children).

### StepKindPicker

Grid 2x3 (mobile 1x6) di KindCard. Click → salva in sessionStorage → `router.push("?step=2")`.

KindCard:
```
[icon kind]
ARTIST
Musicista, producer, cantautore
"Reel snippet, drop, after-release"
```
Colori da KIND_LABELS palette esistente.

### StepIdentity

Form 4 campi (displayName required). Submit → POST `/api/projects` con kind da sessionStorage. Riusa CreateBody zod del backend (già strict).

Su successo: chiama `/api/projects/[id]/activate` → router.push `?step=3`.

### StepSocialConnect

4 card platform (IG/FB, TikTok, YouTube, Spotify). Stato connessione mostrato (DB query `socialAccount.findMany` per project attivo). Click "Connetti" → redirect a `/api/connect/[platform]/start` con `?next=/onboarding?step=4` come state extra.

Bottom: "Continua senza connettere → step 4".

### StepGeneratePlan

```tsx
useEffect(() => {
  if (started) return;
  setStarted(true);
  fetch("/api/suggestions/generate", { method: "POST" })
    .then(...) ...
}, []);
```

Loading state con spinner + animazione ("Claude sta generando il tuo piano…"). Fallback se `no_api_key` o errore: messaggio + CTA "Vai a /impostazioni per setup".

Su successo: countdown 2s → router.push("/suggerimenti").

## API changes

**Nessuna API nuova richiesta.** Riusa:
- `POST /api/projects` (M16 T6)
- `POST /api/projects/[id]/activate` (M16 T8)
- `POST /api/suggestions/generate` (M16 T9 already withProjectRoute)
- Connect routes (M16 T12 con OAuth state firmato)

Solo modifica connect callback per supportare query `?next=/onboarding?step=4` come redirect post-OAuth (oggi torna a `/impostazioni`).

## Schema changes

**Nessuna.** M17 è UX puro su API esistenti.

## Testing

```
components/onboarding/WizardShell.test.tsx       # step indicator, nav callbacks
components/onboarding/StepKindPicker.test.tsx    # click → sessionStorage + router
components/onboarding/StepIdentity.test.tsx      # form validation + API call
```

Skip test componenti che richiedono router mock complesso (Step3 Skip, Step4 useEffect) — coperti da smoke test manuale.

Target: +5 test (118 totali).

## Migration

Nessuna. Solo redirect change in `app/(app)/layout.tsx`.

## Out of scope

- Onboarding analytics (eventi step completati) — M18+
- Tooltip tour dopo wizard — futuro
- Re-invitable wizard ("Riguarda introduzione") — futuro
- A/B test wizard variants — futuro
