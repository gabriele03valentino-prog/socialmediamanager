import type { PostMortem } from "@prisma/client";
import { PLATFORM_LABEL } from "@/lib/utils";
import { OutcomeBadge } from "./OutcomeBadge";

interface PostMortemCardProps {
  mortem: PostMortem;
}

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}×`;
}

export function PostMortemCard({ mortem }: PostMortemCardProps) {
  const captionSnippet = mortem.caption?.slice(0, 200) ?? null;

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={mortem.outcome} />
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {PLATFORM_LABEL[mortem.platform] ?? mortem.platform}
        </span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {mortem.contentType}
        </span>
        <span className="ml-auto text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {formatRatio(mortem.ratio)}{" "}
          <span className="text-xs font-normal text-neutral-500">
            ({mortem.metric})
          </span>
        </span>
      </div>

      <div className="mt-2 text-xs text-neutral-500">
        Post: {mortem.postValue.toLocaleString("it-IT")} · baseline mediana:{" "}
        {mortem.baselineMed.toLocaleString("it-IT")}
      </div>

      {captionSnippet ? (
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
          {captionSnippet}
          {(mortem.caption?.length ?? 0) > 200 ? "…" : ""}
        </p>
      ) : null}

      {mortem.insightTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mortem.insightTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-700/20 dark:text-violet-100"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 text-[11px] text-neutral-400">
        {new Date(mortem.createdAt).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </div>
    </li>
  );
}
