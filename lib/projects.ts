import { prisma } from "@/lib/db";

export const MAX_PROJECTS_PER_USER = 5;

export function isAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.EMAIL_ALLOWLIST;
  if (!raw) return false;
  const norm = email.trim().toLowerCase();
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(norm);
}

export async function canCreateProject(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return false;
  if (isAllowlisted(user.email)) return true;
  const count = await prisma.project.count({ where: { userId } });
  return count < MAX_PROJECTS_PER_USER;
}
