import { NotImplementedYet, type PlatformAdapter } from "./adapter";

// Instagram + Facebook via Graph API.
// Milestone: M1. Sotto trovi gli endpoint esatti da chiamare e la struttura
// delle risposte attese — decrittare il token con decryptToken(account.accessTokenEnc).

export const GRAPH_API_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// OAuth scopes richiesti per IG Business / Creator:
//   instagram_basic, instagram_manage_insights,
//   pages_read_engagement, pages_show_list, business_management
// L'account IG deve essere Business o Creator e collegato a una Pagina FB.

export const metaAdapter: PlatformAdapter = {
  platform: "INSTAGRAM",

  async syncMetrics() {
    // TODO (M1): con Graph API:
    //  1. GET /me/accounts?access_token=... → lista Pagine FB
    //  2. Per ogni Pagina: GET /{page-id}?fields=instagram_business_account → IG id
    //  3. GET /{ig-id}?fields=followers_count,follows_count,media_count
    //  4. GET /{ig-id}/insights?metric=reach,impressions,profile_views&period=day
    throw new NotImplementedYet("INSTAGRAM", "syncMetrics");
  },

  async syncRecentPosts() {
    // TODO (M1): GET /{ig-id}/media?fields=id,caption,media_type,permalink,timestamp,
    //   like_count,comments_count,insights.metric(reach,impressions,saved,shares,plays)
    throw new NotImplementedYet("INSTAGRAM", "syncRecentPosts");
  },

  async syncAudience() {
    // TODO (M1): GET /{ig-id}/insights?metric=audience_gender_age,audience_country,audience_city&period=lifetime
    // Richiede ≥100 follower, altrimenti restituisce errore 100 "not enough data".
    // In quel caso ritornare null (gestito dal layer di sync).
    return null;
  },
};
