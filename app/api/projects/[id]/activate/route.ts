import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setActiveProjectCookie, ProjectNotOwnedError } from "@/lib/active-project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const res = NextResponse.json({ ok: true, projectId: id });
  try {
    await setActiveProjectCookie(res, session.user.id, id);
  } catch (err) {
    if (err instanceof ProjectNotOwnedError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
  return res;
}
