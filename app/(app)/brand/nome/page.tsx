import Link from "next/link";
import { redirect } from "next/navigation";
import { StageNameWizard } from "@/components/StageNameWizard";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import type { HandleStatus } from "@/lib/handle-check";

export const dynamic = "force-dynamic";

export default async function StageNamePage() {
  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

  const ideas = await prisma.stageNameIdea.findMany({
    where: { projectId: project.id },
    orderBy: [{ chosen: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const typedIdeas = ideas.map((i) => ({
    id: i.id,
    name: i.name,
    rationale: i.rationale,
    chosen: i.chosen,
    availability: (i.availability ?? null) as {
      instagram: HandleStatus;
      tiktok: HandleStatus;
      spotify: HandleStatus;
    } | null,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/brand" className="text-sm text-brand-600 hover:underline">
          ← Brand
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Scelta stage name</h1>
        <p className="text-sm text-neutral-500">
          Genera proposte di nome d'arte con rationale e check disponibilità su
          Instagram, TikTok e Spotify. Puoi rilanciare quante volte vuoi: le
          idee si accumulano.
        </p>
      </header>

      <StageNameWizard initialIdeas={typedIdeas} />

      <p className="text-xs text-neutral-500">
        ℹ️ Spotify viene verificato automaticamente via API ufficiale. Per
        Instagram e TikTok clicca direttamente il chip per aprire il profilo in
        una nuova tab — è il check più affidabile, queste piattaforme bloccano i
        probe HTTP dai server.
      </p>
    </div>
  );
}
