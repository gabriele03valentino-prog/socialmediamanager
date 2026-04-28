import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveProject } from "@/lib/active-project";
import { ProjectKindBadge } from "@/components/ProjectKindBadge";
import { ProjectSettingsForm } from "@/components/ProjectSettingsForm";
import { canCreateProject, MAX_PROJECTS_PER_USER } from "@/lib/projects";

export const dynamic = "force-dynamic";

interface SearchParams {
  p?: string;
  create?: string;
}

export default async function ProgettiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const params = await searchParams;
  const allowCreate = await canCreateProject(session.user.id);

  let selected = projects.find((p) => p.id === params.p);
  if (!selected) {
    selected = (await getActiveProject()) || projects[0];
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Progetti</h1>
        <p className="text-xs text-gray-500">
          {projects.length} / {MAX_PROJECTS_PER_USER}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-700">Nessun progetto ancora.</p>
          <p className="mt-1 text-xs text-gray-500">
            Crea il primo dal pulsante &quot;+ Nuovo progetto&quot; nella sidebar.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="space-y-2">
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/progetti?p=${p.id}`}
                    className={`block rounded border p-3 ${
                      selected?.id === p.id
                        ? "border-violet-300 bg-violet-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="text-sm font-medium">{p.displayName}</div>
                    <ProjectKindBadge kind={p.kind} className="mt-1" />
                  </Link>
                </li>
              ))}
            </ul>
            {!allowCreate && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                Hai raggiunto il limite di {MAX_PROJECTS_PER_USER} progetti.
              </p>
            )}
          </aside>

          <main>
            {selected && <ProjectSettingsForm project={selected} />}
          </main>
        </div>
      )}
    </div>
  );
}
