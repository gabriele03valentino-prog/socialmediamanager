export interface FeedbackItem {
  userId: string;
  project: { id: string; displayName: string; kind: string };
  feedback: { headline: string; body: string; postsCount: number };
}

export interface GroupedFeedback {
  userId: string;
  projects: Array<{
    displayName: string;
    kind: string;
    headline: string;
    body: string;
    postsCount: number;
  }>;
}

export function groupFeedbackByUser(items: FeedbackItem[]): GroupedFeedback[] {
  const map = new Map<string, GroupedFeedback>();
  for (const item of items) {
    let group = map.get(item.userId);
    if (!group) {
      group = { userId: item.userId, projects: [] };
      map.set(item.userId, group);
    }
    group.projects.push({
      displayName: item.project.displayName,
      kind: item.project.kind,
      headline: item.feedback.headline,
      body: item.feedback.body,
      postsCount: item.feedback.postsCount,
    });
  }
  return Array.from(map.values());
}
