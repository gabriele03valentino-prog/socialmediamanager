import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyFeedback } from "@/lib/ai/feedback";
import { sendAggregatedDailyFeedbackEmail } from "@/lib/email";
import { groupFeedbackByUser, type FeedbackItem } from "@/lib/cron-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("forbidden", { status: 403 });

  const projects = await prisma.project.findMany({
    where: { emailFeedbackEnabled: true },
    include: { user: { select: { id: true, email: true } } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: FeedbackItem[] = [];
  for (const project of projects) {
    try {
      const feedback = await generateDailyFeedback(
        { id: project.id, kind: project.kind, displayName: project.displayName },
        today,
      );
      if (!feedback) continue;
      await prisma.dailyFeedback.upsert({
        where: { projectId_forDate: { projectId: project.id, forDate: today } },
        create: {
          projectId: project.id,
          forDate: today,
          headline: feedback.headline,
          body: feedback.body,
          postsCount: feedback.postsCount,
          generatedBy: feedback.generatedBy,
        },
        update: {
          headline: feedback.headline,
          body: feedback.body,
          postsCount: feedback.postsCount,
          generatedBy: feedback.generatedBy,
        },
      });
      items.push({
        userId: project.userId,
        project: { id: project.id, displayName: project.displayName, kind: project.kind },
        feedback,
      });
    } catch (err) {
      console.error(`feedback failed for ${project.id}`, err);
    }
  }

  const grouped = groupFeedbackByUser(items);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let emailsSent = 0;
  for (const group of grouped) {
    const userEmail = projects.find((p) => p.userId === group.userId)?.user.email;
    if (!userEmail) continue;
    const result = await sendAggregatedDailyFeedbackEmail(userEmail, {
      forDate: today,
      appUrl,
      projects: group.projects,
    });
    if (result.ok) emailsSent++;
  }

  return NextResponse.json({
    ok: true,
    projectsProcessed: items.length,
    emailsSent,
  });
}
