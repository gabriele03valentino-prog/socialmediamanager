import { redirect } from "next/navigation";
import { GoalsView } from "@/components/GoalsView";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { getGoalProgress } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default async function ObiettiviPage() {
  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

  const goals = await prisma.goal.findMany({
    where: { projectId: project.id },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
  });

  const withProgress = await Promise.all(
    goals.map(async (g) => ({ ...g, progress: await getGoalProgress(g) })),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Obiettivi</h1>
        <p className="text-sm text-neutral-500">
          Traguardi misurabili per piattaforma. Lo storico dei tuoi snapshot
          (sync giornaliero) determina la progressione e il trend.
        </p>
      </header>
      <GoalsView goals={withProgress} />
    </div>
  );
}
