// Spotify adapter. Schema SocialAccount:
//   externalId  = artist id Spotify (22 char)
//   meta        = { artistName, popularity, genres[], topTracks[], latestRelease? }
// accessTokenEnc non è usato per questa piattaforma (client credentials
// globale via getAppToken), ma il campo è obbligatorio nello schema: store "".

import type { PlatformAdapter, PostResult } from "./adapter";
import {
  fetchArtist,
  fetchArtistReleases,
  fetchArtistTopTracks,
} from "./spotify-oauth";

export const spotifyAdapter: PlatformAdapter = {
  platform: "SPOTIFY",

  async syncMetrics(account) {
    const artist = await fetchArtist(account.externalId);
    const topTracks = await fetchArtistTopTracks(account.externalId);
    return {
      followers: artist.followers.total,
      // Popolarità 0-100 di Spotify, buona come proxy di trending.
      extra: {
        popularity: artist.popularity,
        genres: artist.genres,
        topTracksPopularity: topTracks.map((t) => t.popularity),
        // ⚠️ Gli ascoltatori mensili NON sono esposti dall'API pubblica.
        // L'utente li aggiorna manualmente da /impostazioni/spotify.
      },
    };
  },

  async syncRecentPosts(account) {
    const releases = await fetchArtistReleases(account.externalId);
    const posts: PostResult[] = releases.map((r) => ({
      externalId: r.id,
      postedAt: new Date(r.release_date),
      // In Spotify il "post" è l'uscita discografica → mappiamo in POST.
      mediaType: "OTHER" as const,
      caption: `${r.album_type === "single" ? "Single" : "Album"}: ${r.name} (${r.total_tracks} tracce)`,
      permalink: r.external_urls?.spotify,
    }));
    return posts;
  },

  async syncAudience() {
    // Non disponibile su Web API pubblica.
    return null;
  },
};
