import { NotImplementedYet, type PlatformAdapter } from "./adapter";

// TikTok Display API (account proprietario).
// Milestone: M3.
//
// OAuth: https://open.tiktokapis.com/v2/oauth/token/
// Scopes: user.info.basic, user.info.stats, video.list
//
// Endpoints:
//  - POST https://open.tiktokapis.com/v2/user/info/
//      body: { fields: ["open_id","display_name","follower_count","following_count",
//                       "likes_count","video_count","avatar_url"] }
//  - POST https://open.tiktokapis.com/v2/video/list/
//      body: { fields: ["id","create_time","cover_image_url","view_count",
//                       "like_count","comment_count","share_count","duration",
//                       "video_description"], max_count: 20 }
//
// Nota: l'audience demografica NON è disponibile via Display API.
// La Research API di TikTok richiede approvazione accademica → la omettiamo.

export const tiktokAdapter: PlatformAdapter = {
  platform: "TIKTOK",

  async syncMetrics() {
    throw new NotImplementedYet("TIKTOK", "syncMetrics");
  },

  async syncRecentPosts() {
    throw new NotImplementedYet("TIKTOK", "syncRecentPosts");
  },

  async syncAudience() {
    // Non supportato → null (il layer di sync lo gestisce).
    return null;
  },
};
