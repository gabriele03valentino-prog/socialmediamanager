import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { TrendsList } from "@/components/TrendsList";

export const dynamic = "force-dynamic";

export default async function TrendPage() {
  const project = await getActiveProject();
  if (!project) redirect("/progetti?create=1");

  const trends = await prisma.trend.findMany({
    where: { projectId: project.id },
    orderBy: { notedAt: "desc" },
  });

  const active = trends.filter((t) => t.status === "ACTIVE");
  const warming = trends.filter((t) => t.status === "WARMING");
  const expired = trends.filter((t) => t.status === "EXPIRED");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Trend</h1>
        <p className="text-sm text-neutral-500">
          Libreria di sound, format, topic e challenge da agganciare nei
          contenuti. I trend attivi vengono passati al recommender quando genera
          il piano settimanale.
        </p>
      </header>
      <TrendsList active={active} warming={warming} expired={expired} />
    </div>
  );
}
