import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  monthlyListeners: z.coerce.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return withProjectRoute(req, async (project) => {
    const contentType = req.headers.get("content-type") ?? "";
    let input: unknown;
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      input = { monthlyListeners: fd.get("monthlyListeners") };
    } else {
      input = await req.json().catch(() => ({}));
    }

    const parsed = Body.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { projectId: project.id, platform: "SPOTIFY" },
    });
    if (!account) {
      return NextResponse.json({ error: "spotify_not_connected" }, { status: 404 });
    }

    await prisma.metricSnapshot.create({
      data: {
        accountId: account.id,
        followers: undefined, // non sovrascriviamo il follower count API
        extra: {
          manualMonthlyListeners: parsed.data.monthlyListeners,
        },
      },
    });

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const origin = new URL(req.url).origin;
      const target = new URL("/impostazioni/spotify", origin);
      target.searchParams.set("updated", "1");
      return NextResponse.redirect(target, 303);
    }
    return NextResponse.json({ ok: true });
  });
}
