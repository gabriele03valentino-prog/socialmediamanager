import type { Persona } from "@prisma/client";

export function PersonaCard({ persona }: { persona: Persona }) {
  const triggers = Array.isArray(persona.triggers)
    ? (persona.triggers as unknown as string[])
    : [];
  const refs = Array.isArray(persona.culturalRefs)
    ? (persona.culturalRefs as unknown as string[])
    : [];

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-xl font-semibold">{persona.name}</h3>
          <div className="mt-0.5 text-xs text-neutral-500">
            {persona.ageRange} · {persona.location} · {persona.occupation}
          </div>
        </div>
        <div className="flex gap-1">
          {persona.platforms.slice(0, 3).map((p) => (
            <span
              key={p}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
            >
              {p}
            </span>
          ))}
        </div>
      </header>

      <section className="mb-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Abitudini musicali
        </div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {persona.musicHabits}
        </p>
      </section>

      {persona.listeningTimes ? (
        <section className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Fasce orarie
          </div>
          <p className="text-sm">{persona.listeningTimes}</p>
        </section>
      ) : null}

      <section className="mb-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Trigger che funzionano
        </div>
        <ul className="space-y-1 text-sm">
          {triggers.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-brand-600">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Riferimenti culturali
        </div>
        <div className="flex flex-wrap gap-1.5">
          {refs.map((r, i) => (
            <span
              key={i}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
            >
              {r}
            </span>
          ))}
        </div>
      </section>
    </article>
  );
}
