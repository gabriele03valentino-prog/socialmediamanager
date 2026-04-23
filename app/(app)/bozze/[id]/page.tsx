import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DraftEditor } from "@/components/DraftEditor";
import {
  type NeuroBreakdown,
  type NeuroScoreData,
  NeuroScoreSection,
} from "@/components/NeuroScoreSection";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const draft = await prisma.draft.findUnique({
    where: { id },
    include: { neuroScore: true },
  });
  if (!draft || draft.userId !== session.user.id) notFound();

  const neuroData: NeuroScoreData | null = draft.neuroScore
    ? {
        score: draft.neuroScore.score,
        breakdown: draft.neuroScore
          .breakdown as unknown as NeuroBreakdown,
        improvements: draft.neuroScore
          .improvements as unknown as string[],
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/bozze" className="text-sm text-brand-600 hover:underline">
          ← tutte le bozze
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Bozza</h1>
        <p className="text-sm text-neutral-500">
          Modifica caption, hashtag e orario. Quando è pronta, copia tutto e
          pubblica a mano sull'app della piattaforma.
        </p>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <DraftEditor draft={draft} />
        <NeuroScoreSection target="draft" id={draft.id} initial={neuroData} />
      </div>
    </div>
  );
}
