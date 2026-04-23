import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  stageName: z.string().min(1).max(80),
  genre: z.string().min(1).max(80),
  city: z.string().max(80).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  websiteUrl: z
    .string()
    .url()
    .max(300)
    .optional()
    .or(z.literal("")),
  targetFollowersIG: z.coerce.number().int().nonnegative().optional(),
  targetByDate: z.string().optional().or(z.literal("")),
  targetAvgTiktokViews: z.coerce.number().int().nonnegative().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let input: unknown;
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    input = Object.fromEntries(fd);
  } else {
    input = await req.json().catch(() => ({}));
  }

  const parsed = Body.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const goals =
    parsed.data.targetFollowersIG ||
    parsed.data.targetByDate ||
    parsed.data.targetAvgTiktokViews
      ? {
          targetFollowersIG: parsed.data.targetFollowersIG ?? null,
          targetByDate: parsed.data.targetByDate || null,
          targetAvgTiktokViews: parsed.data.targetAvgTiktokViews ?? null,
        }
      : undefined;

  await prisma.artistProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      stageName: parsed.data.stageName,
      genre: parsed.data.genre,
      city: parsed.data.city || undefined,
      bio: parsed.data.bio || undefined,
      websiteUrl: parsed.data.websiteUrl || undefined,
      goals: goals as never,
    },
    update: {
      stageName: parsed.data.stageName,
      genre: parsed.data.genre,
      city: parsed.data.city || null,
      bio: parsed.data.bio || null,
      websiteUrl: parsed.data.websiteUrl || null,
      goals: goals as never,
    },
  });

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(new URL("/impostazioni?profile=saved", origin), 303);
  }
  return NextResponse.json({ ok: true });
}
