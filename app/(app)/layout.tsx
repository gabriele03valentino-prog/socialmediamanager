import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveProject } from "@/lib/active-project";
import { SidebarNav } from "@/components/SidebarNav";
import { UserMenu } from "@/components/UserMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, kind: true },
    orderBy: { createdAt: "asc" },
  });

  if (projects.length === 0) redirect("/onboarding");

  const activeProject =
    (await getActiveProject()) ||
    (await prisma.project.findUniqueOrThrow({ where: { id: projects[0]!.id } }));

  return (
    <div className="flex min-h-screen">
      <SidebarNav activeProject={activeProject} projects={projects}>
        <UserMenu
          name={session.user.name}
          email={session.user.email}
          image={session.user.image}
        />
      </SidebarNav>
      <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-8 md:pt-8">{children}</main>
    </div>
  );
}
