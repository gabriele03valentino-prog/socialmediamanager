import { NotImplementedYet, type PlatformAdapter } from "./adapter";

// YouTube Data API v3 + YouTube Analytics API.
// Milestone: M2. È il connettore più semplice: OAuth Google standard, buon rate-limit.
//
// OAuth scopes:
//   https://www.googleapis.com/auth/youtube.readonly
//   https://www.googleapis.com/auth/yt-analytics.readonly
//
// Endpoints chiave:
//  - Data v3  GET /youtube/v3/channels?mine=true&part=snippet,statistics,contentDetails
//  - Data v3  GET /youtube/v3/playlistItems?playlistId={uploads}&part=contentDetails&maxResults=50
//  - Data v3  GET /youtube/v3/videos?id=...&part=snippet,statistics,contentDetails
//  - Analytics GET /v2/reports?ids=channel==MINE&metrics=views,estimatedMinutesWatched,
//              averageViewDuration,subscribersGained&dimensions=day&startDate=...&endDate=...
//  - Demografica: aggiungere dimensions=ageGroup,gender oppure country a query separate.

export const youtubeAdapter: PlatformAdapter = {
  platform: "YOUTUBE",

  async syncMetrics() {
    throw new NotImplementedYet("YOUTUBE", "syncMetrics");
  },

  async syncRecentPosts() {
    throw new NotImplementedYet("YOUTUBE", "syncRecentPosts");
  },

  async syncAudience() {
    throw new NotImplementedYet("YOUTUBE", "syncAudience");
  },
};
