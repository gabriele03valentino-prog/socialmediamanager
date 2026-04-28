import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// Layout dedicato wizard onboarding — niente sidebar, focus full-screen.
// Sovrascrive il SidebarNav del parent (app) layout? No: Next.js nest layouts,
// quindi il parent layout fa già il redirect /login se no session, ma forza
// SidebarNav. Soluzione: questo layout NON nesta dentro (app) layout — viene
// montato su Next.js route segment, ma per evitare sidebar siamo dentro un
// route group separato. Manteniamo qui auth + redirect minimal.

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <>{children}</>;
}
