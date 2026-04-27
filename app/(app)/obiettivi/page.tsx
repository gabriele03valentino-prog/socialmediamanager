import { auth } from "@/auth";
import { GoalsView } from "@/components/GoalsView";
import { prisma } from "@/lib/db";
import { getGoalProgress } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default async function ObiettiviPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
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
