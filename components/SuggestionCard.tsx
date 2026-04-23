import type { Suggestion } from "@prisma/client";
import { SuggestionActions } from "@/components/SuggestionActions";
import { PLATFORM_LABEL } from "@/lib/utils";

export function SuggestionCard({
  s,
  showActions = false,
}: {
  s: Suggestion;
  showActions?: boolean;
}) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <header className="mb-2 flex items-center justify-between text-xs text-neutral-500">
        <span className="inline-flex items-center gap-2">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
            {PLATFORM_LABEL[s.platform]}
          </span>
          <span>{s.contentType}</span>
          <span>·</span>
          <time>{s.forDate.toISOString().slice(0, 10)}</time>
          {s.suggestedTime ? <span>{s.suggestedTime}</span> : null}
        </span>
        <span className="uppercase tracking-wide">{s.status.toLowerCase()}</span>
      </header>
      <h3 className="mb-2 text-base font-semibold">{s.hook}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {s.caption}
      </p>
      {s.hashtags.length > 0 && (
        <p className="mt-3 text-xs text-brand-700 dark:text-brand-200">
          {s.hashtags.map((h) => `#${h}`).join(" ")}
        </p>
      )}
      {s.cta ? (
        <p className="mt-2 text-xs italic text-neutral-500">CTA: {s.cta}</p>
      ) : null}
      {s.rationale ? (
        <p className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
          <span className="font-medium">Perché:</span> {s.rationale}
        </p>
      ) : null}
      {showActions && s.status === "PROPOSED" ? <SuggestionActions id={s.id} /> : null}
    </article>
  );
}
