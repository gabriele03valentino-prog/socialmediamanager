// Adapter reale per Instagram + Facebook via Graph API.
// Ogni SocialAccount Meta ha:
//   externalId         = IG business account id  (per INSTAGRAM)
//                        Facebook Page id        (per FACEBOOK)
//   accessTokenEnc     = Page access token long-lived cifrato
//   meta               = { pageId, pageName, igUsername? }

import { decryptToken } from "@/lib/crypto";
import type { PlatformAdapter } from "./adapter";
import { graphGet } from "./meta-oauth";

export { GRAPH_API_VERSION, GRAPH_BASE } from "./meta-constants";

type IgUserFields = {
  id: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

type IgMedia = {
  id: string;
  caption?: string;
  media_type: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY | AD
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

type IgMediaInsights = {
  data?: Array<{
    name: string;
    values?: Array<{ value: number }>;
  }>;
};

type IgInsightsSimple = {
  data?: Array<{
    name: string;
    values?: Array<{ value: number }>;
    total_value?: { value: number };
  }>;
};

type IgDemographics = {
  data?: Array<{
    name: string;
    total_value?: {
      breakdowns?: Array<{
        dimension_keys: string[];
        results: Array<{ dimension_values: string[]; value: number }>;
      }>;
    };
  }>;
};

function toMediaType(mt: string, mpt?: string): "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL" | "STORY" | "OTHER" {
  if (mpt === "REELS") return "REEL";
  if (mpt === "STORY") return "STORY";
  if (mt === "IMAGE") return "IMAGE";
  if (mt === "VIDEO") return "VIDEO";
  if (mt === "CAROUSEL_ALBUM") return "CAROUSEL";
  return "OTHER";
}

// Somma i value di una lista di insight time-series.
function sumValues(arr?: Array<{ value: number }>): number | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.reduce((s, v) => s + (v.value ?? 0), 0);
}

export const instagramAdapter: PlatformAdapter = {
  platform: "INSTAGRAM",

  async syncMetrics(account) {
    const token = decryptToken(account.accessTokenEnc);

    const user = await graphGet<IgUserFields>(
      `/${account.externalId}`,
      { fields: "id,followers_count,follows_count,media_count" },
      token,
    );

    let reach: number | undefined;
    let profileViews: number | undefined;
    try {
      const insights = await graphGet<IgInsightsSimple>(
        `/${account.externalId}/insights`,
        { metric: "reach,profile_views", period: "day" },
        token,
      );
      for (const m of insights.data ?? []) {
        if (m.name === "reach") reach = sumValues(m.values);
        if (m.name === "profile_views") profileViews = sumValues(m.values);
      }
    } catch {
      // Alcuni account hanno limiti diversi (es. Creator vs Business) —
      // non facciamo fallire l'intero sync per gli insights.
    }

    return {
      followers: user.followers_count,
      following: user.follows_count,
      postsCount: user.media_count,
      reach,
      profileViews,
    };
  },

  async syncRecentPosts(account) {
    const token = decryptToken(account.accessTokenEnc);

    const list = await graphGet<{ data?: IgMedia[] }>(
      `/${account.externalId}/media`,
      {
        fields:
          "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
        limit: "25",
      },
      token,
    );
    const media = list.data ?? [];

    const out = await Promise.all(
      media.map(async (m) => {
        let reach: number | undefined;
        let saves: number | undefined;
        let shares: number | undefined;
        let views: number | undefined;
        try {
          const ins = await graphGet<IgMediaInsights>(
            `/${m.id}/insights`,
            {
              metric:
                m.media_product_type === "REELS"
                  ? "reach,saved,shares,views"
                  : "reach,saved,shares",
            },
            token,
          );
          for (const row of ins.data ?? []) {
            const v = row.values?.[0]?.value;
            if (row.name === "reach") reach = v;
            if (row.name === "saved") saves = v;
            if (row.name === "shares") shares = v;
            if (row.name === "views") views = v;
          }
        } catch {
          // Alcuni media non espongono insights (storie scadute, media sponsorizzati, ecc.).
        }

        return {
          externalId: m.id,
          postedAt: new Date(m.timestamp),
          mediaType: toMediaType(m.media_type, m.media_product_type),
          caption: m.caption,
          permalink: m.permalink,
          likes: m.like_count,
          comments: m.comments_count,
          saves,
          shares,
          views,
          reach,
        };
      }),
    );

    return out;
  },

  async syncAudience(account) {
    const token = decryptToken(account.accessTokenEnc);

    // follower_demographics con breakdown per age, gender, country.
    // Richiede ≥100 follower; in caso contrario Meta restituisce error 100.
    try {
      const [age, gender, country] = await Promise.all([
        graphGet<IgDemographics>(
          `/${account.externalId}/insights`,
          {
            metric: "follower_demographics",
            period: "lifetime",
            metric_type: "total_value",
            breakdown: "age",
          },
          token,
        ),
        graphGet<IgDemographics>(
          `/${account.externalId}/insights`,
          {
            metric: "follower_demographics",
            period: "lifetime",
            metric_type: "total_value",
            breakdown: "gender",
          },
          token,
        ),
        graphGet<IgDemographics>(
          `/${account.externalId}/insights`,
          {
            metric: "follower_demographics",
            period: "lifetime",
            metric_type: "total_value",
            breakdown: "country",
          },
          token,
        ),
      ]);

      const ageBuckets = toShareMap(extractBreakdown(age));
      const genderSplit = toShareMap(extractBreakdown(gender));
      const countryBuckets = extractBreakdown(country);
      const topCountries = Object.entries(toShareMap(countryBuckets))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code, share]) => ({ code, share }));

      return { ageBuckets, genderSplit, topCountries };
    } catch {
      return null;
    }
  },
};

function extractBreakdown(resp: IgDemographics): Record<string, number> {
  const entry = resp.data?.[0]?.total_value?.breakdowns?.[0];
  if (!entry) return {};
  const out: Record<string, number> = {};
  for (const r of entry.results) {
    const key = r.dimension_values[0] ?? "unknown";
    out[key] = (out[key] ?? 0) + r.value;
  }
  return out;
}

function toShareMap(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v / total;
  return out;
}

// --- Facebook Page adapter ---
// Metriche per la Pagina. Condivide il flusso OAuth con Instagram.

type FbPageFields = {
  id: string;
  name?: string;
  fan_count?: number;
  followers_count?: number;
};

type FbPageInsights = IgInsightsSimple;

export const facebookAdapter: PlatformAdapter = {
  platform: "FACEBOOK",

  async syncMetrics(account) {
    const token = decryptToken(account.accessTokenEnc);
    const page = await graphGet<FbPageFields>(
      `/${account.externalId}`,
      { fields: "id,name,fan_count,followers_count" },
      token,
    );

    let impressions: number | undefined;
    let reach: number | undefined;
    try {
      const ins = await graphGet<FbPageInsights>(
        `/${account.externalId}/insights`,
        { metric: "page_impressions,page_impressions_unique", period: "day" },
        token,
      );
      for (const m of ins.data ?? []) {
        const v = sumValues(m.values);
        if (m.name === "page_impressions") impressions = v;
        if (m.name === "page_impressions_unique") reach = v;
      }
    } catch {
      // Pagine piccole potrebbero non avere insight sufficienti.
    }

    return {
      followers: page.followers_count ?? page.fan_count,
      reach,
      impressions,
    };
  },

  async syncRecentPosts(account) {
    const token = decryptToken(account.accessTokenEnc);
    const list = await graphGet<{
      data?: Array<{
        id: string;
        message?: string;
        created_time: string;
        permalink_url?: string;
      }>;
    }>(
      `/${account.externalId}/posts`,
      { fields: "id,message,created_time,permalink_url", limit: "25" },
      token,
    );
    const posts = list.data ?? [];

    const out = await Promise.all(
      posts.map(async (p) => {
        let reach: number | undefined;
        let impressions: number | undefined;
        try {
          const ins = await graphGet<FbPageInsights>(
            `/${p.id}/insights`,
            { metric: "post_impressions,post_impressions_unique" },
            token,
          );
          for (const m of ins.data ?? []) {
            const v = m.values?.[0]?.value;
            if (m.name === "post_impressions") impressions = v;
            if (m.name === "post_impressions_unique") reach = v;
          }
        } catch {
          // idem
        }
        return {
          externalId: p.id,
          postedAt: new Date(p.created_time),
          mediaType: "OTHER" as const,
          caption: p.message,
          permalink: p.permalink_url,
          reach,
          impressions,
        };
      }),
    );
    return out;
  },

  async syncAudience() {
    // page_fans_country / page_fans_gender_age esistono ma richiedono 100+ like
    // e sono stati progressivamente deprecati. Per M1 ritorniamo null; lo
    // riabilitiamo in una milestone se l'utente lo richiede.
    return null;
  },
};

// Retrocompatibilità con l'import esistente in lib/platforms/index.ts.
export const metaAdapter = instagramAdapter;
