// YouTube connector.
// Schema SocialAccount per YouTube:
//   externalId       = channel id (UC...)
//   accessTokenEnc   = access token cifrato (vita ~1h, auto-refresh)
//   refreshTokenEnc  = refresh token cifrato (long-lived)
//   expiresAt        = scadenza access token
//   meta             = { uploadsPlaylistId, title, customUrl? }

import type { SocialAccount } from "@prisma/client";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import type { PlatformAdapter, PostResult } from "./adapter";
import { refreshAccessToken } from "./youtube-oauth";

const DATA_BASE = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2";

async function getValidAccessToken(account: SocialAccount): Promise<string> {
  const expiresAt = account.expiresAt?.getTime();
  const safeNow = Date.now() + 60_000; // 1 min di margine
  if (expiresAt && expiresAt > safeNow) {
    return decryptToken(account.accessTokenEnc);
  }
  if (!account.refreshTokenEnc) {
    throw new Error("YouTube: refresh token mancante. Riconnetti l'account.");
  }
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET non configurati");
  }
  const refreshed = await refreshAccessToken({
    refreshToken: decryptToken(account.refreshTokenEnc),
    clientId,
    clientSecret,
  });
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: encryptToken(refreshed.access_token),
      expiresAt: newExpiresAt,
    },
  });
  return refreshed.access_token;
}

async function ytFetch<T>(
  base: string,
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `YouTube ${path} fallito: ${res.status} ${await res.text()}`.slice(0, 500),
    );
  }
  return (await res.json()) as T;
}

// Converte durata ISO 8601 (es. PT1M30S) in secondi.
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h, mm, s] = m;
  return Number(h ?? 0) * 3600 + Number(mm ?? 0) * 60 + Number(s ?? 0);
}

type ChannelStats = {
  items?: Array<{
    statistics: {
      subscriberCount?: string;
      videoCount?: string;
      viewCount?: string;
    };
    contentDetails: { relatedPlaylists?: { uploads?: string } };
  }>;
};

type PlaylistItems = {
  items?: Array<{
    contentDetails: { videoId: string; videoPublishedAt?: string };
    snippet: { title?: string; description?: string; publishedAt?: string };
  }>;
  nextPageToken?: string;
};

type VideosList = {
  items?: Array<{
    id: string;
    snippet: {
      publishedAt: string;
      title: string;
      description?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
    contentDetails: { duration: string };
  }>;
};

type AnalyticsReport = {
  columnHeaders?: Array<{ name: string; dataType: string; columnType: string }>;
  rows?: Array<Array<string | number>>;
};

export const youtubeAdapter: PlatformAdapter = {
  platform: "YOUTUBE",

  async syncMetrics(account) {
    const token = await getValidAccessToken(account);
    const resp = await ytFetch<ChannelStats>(
      DATA_BASE,
      "/channels",
      { mine: "true", part: "statistics,contentDetails" },
      token,
    );
    const ch = resp.items?.[0];
    if (!ch) return {};
    const totalViews = ch.statistics.viewCount
      ? Number(ch.statistics.viewCount)
      : undefined;

    // Analytics ultimi 28 giorni per reach/watch time.
    let views28d: number | undefined;
    let watchMinutes28d: number | undefined;
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 28 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const report = await ytFetch<AnalyticsReport>(
        ANALYTICS_BASE,
        "/reports",
        {
          ids: "channel==MINE",
          metrics: "views,estimatedMinutesWatched",
          startDate,
          endDate,
        },
        token,
      );
      const row = report.rows?.[0];
      if (row) {
        views28d = Number(row[0]);
        watchMinutes28d = Number(row[1]);
      }
    } catch {
      // analytics occasionalmente indisponibile per canali nuovi
    }

    return {
      followers: ch.statistics.subscriberCount
        ? Number(ch.statistics.subscriberCount)
        : undefined,
      postsCount: ch.statistics.videoCount
        ? Number(ch.statistics.videoCount)
        : undefined,
      impressions: views28d,
      extra: {
        totalViews,
        views28d,
        watchMinutes28d,
      },
    };
  },

  async syncRecentPosts(account) {
    const token = await getValidAccessToken(account);

    // Uploads playlist id può essere cambiato se riconvertiamo canali;
    // ce lo rileggiamo sempre al volo.
    const channelResp = await ytFetch<ChannelStats>(
      DATA_BASE,
      "/channels",
      { mine: "true", part: "contentDetails" },
      token,
    );
    const uploadsId = channelResp.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) return [];

    const items = await ytFetch<PlaylistItems>(
      DATA_BASE,
      "/playlistItems",
      {
        playlistId: uploadsId,
        part: "contentDetails,snippet",
        maxResults: "25",
      },
      token,
    );
    const ids = (items.items ?? [])
      .map((it) => it.contentDetails.videoId)
      .filter((x): x is string => Boolean(x));
    if (ids.length === 0) return [];

    const videos = await ytFetch<VideosList>(
      DATA_BASE,
      "/videos",
      { id: ids.join(","), part: "snippet,statistics,contentDetails" },
      token,
    );

    const posts: PostResult[] = (videos.items ?? []).map((v) => {
      const durationSec = parseDurationSeconds(v.contentDetails.duration);
      // Heuristica: video ≤60s = Short (YouTube non espone un flag diretto).
      const mediaType = durationSec > 0 && durationSec <= 60 ? "SHORT" : "VIDEO";
      const desc = v.snippet.description?.trim();
      const caption = desc ? `${v.snippet.title}\n\n${desc}` : v.snippet.title;
      return {
        externalId: v.id,
        postedAt: new Date(v.snippet.publishedAt),
        mediaType,
        caption,
        permalink: `https://www.youtube.com/watch?v=${v.id}`,
        likes: v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined,
        comments: v.statistics?.commentCount
          ? Number(v.statistics.commentCount)
          : undefined,
        views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
        raw: { durationSec },
      };
    });
    return posts;
  },

  async syncAudience(account) {
    const token = await getValidAccessToken(account);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    try {
      const [ageGender, country] = await Promise.all([
        ytFetch<AnalyticsReport>(
          ANALYTICS_BASE,
          "/reports",
          {
            ids: "channel==MINE",
            metrics: "viewerPercentage",
            dimensions: "ageGroup,gender",
            startDate,
            endDate,
          },
          token,
        ),
        ytFetch<AnalyticsReport>(
          ANALYTICS_BASE,
          "/reports",
          {
            ids: "channel==MINE",
            metrics: "views",
            dimensions: "country",
            startDate,
            endDate,
            sort: "-views",
            maxResults: "10",
          },
          token,
        ),
      ]);

      const ageBuckets: Record<string, number> = {};
      const genderSplit: Record<string, number> = {};
      for (const row of ageGender.rows ?? []) {
        const [age, gender, pct] = row as [string, string, number];
        // YouTube restituisce viewerPercentage come percentuale (0-100) sommati
        // per combinazione age×gender; li aggreghiamo e normalizziamo in share 0-1.
        ageBuckets[age] = (ageBuckets[age] ?? 0) + pct / 100;
        genderSplit[gender] = (genderSplit[gender] ?? 0) + pct / 100;
      }
      const total = Object.values(ageBuckets).reduce((s, v) => s + v, 0) || 1;
      for (const k of Object.keys(ageBuckets)) ageBuckets[k] = ageBuckets[k]! / total;
      const gTotal = Object.values(genderSplit).reduce((s, v) => s + v, 0) || 1;
      for (const k of Object.keys(genderSplit)) {
        genderSplit[k] = genderSplit[k]! / gTotal;
      }

      const countryRows = country.rows ?? [];
      const countryTotal = countryRows.reduce((s, r) => s + Number(r[1]), 0) || 1;
      const topCountries = countryRows.map((r) => ({
        code: String(r[0]),
        share: Number(r[1]) / countryTotal,
      }));

      return { ageBuckets, genderSplit, topCountries };
    } catch {
      return null;
    }
  },
};
