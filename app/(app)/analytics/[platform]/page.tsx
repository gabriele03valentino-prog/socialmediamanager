import { notFound, redirect } from "next/navigation";
import type { Platform } from "@prisma/client";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID: Platform[] = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "SPOTIFY"];

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform: raw } = await params;
  const platform = raw.toUpperCase() as Platform;
  if (!VALID.includes(platform)) notFound();

  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

  const account = await prisma.socialAccount.findFirst({
    where: { projectId: project.id, platform },
    include: {
      metrics: { orderBy: { capturedAt: "desc" }, take: 30 },
      posts: { orderBy: { postedAt: "desc" }, take: 20 },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analytics · {PLATFORM_LABEL[platform]}</h1>
        {account ? (
          <p className="text-sm text-neutral-500">
            {account.handle}
            {account.lastSyncedAt
              ? ` · ultimo sync ${account.lastSyncedAt.toISOString().slice(0, 16).replace("T", " ")}`
              : null}
          </p>
        ) : (
          <p className="text-sm text-neutral-500">Account non collegato.</p>
        )}
      </header>

      {account ? (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Ultimi snapshot metriche
            </h2>
            {account.metrics.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessuna metrica ancora sincronizzata.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="py-2">Quando</th>
                    <th>Follower</th>
                    <th>Reach</th>
                    <th>Impression</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {account.metrics.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2">
                        {m.capturedAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td>{m.followers?.toLocaleString("it-IT") ?? "—"}</td>
                      <td>{m.reach?.toLocaleString("it-IT") ?? "—"}</td>
                      <td>{m.impressions?.toLocaleString("it-IT") ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Post recenti
            </h2>
            {account.posts.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessun post importato.</p>
            ) : (
              <ul className="space-y-2">
                {account.posts.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <time>{p.postedAt.toISOString().slice(0, 10)}</time>
                      <span>{p.mediaType}</span>
                      <span>❤ {p.likes ?? "—"}</span>
                      <span>💬 {p.comments ?? "—"}</span>
                      {p.reach !== null && p.reach !== undefined ? (
                        <span>reach {p.reach.toLocaleString("it-IT")}</span>
                      ) : null}
                    </div>
                    {p.caption ? (
                      <p className="mt-1 line-clamp-2 text-neutral-700 dark:text-neutral-300">
                        {p.caption}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {platform === "SPOTIFY" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          ⚠️ Spotify non espone ascoltatori mensili via API. Aggiornali manualmente da
          Impostazioni.
        </p>
      ) : null}
      {platform === "TIKTOK" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          ⚠️ TikTok Display API non fornisce demografica del pubblico.
        </p>
      ) : null}
    </div>
  );
}
