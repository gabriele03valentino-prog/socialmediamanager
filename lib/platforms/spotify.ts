import { NotImplementedYet, type PlatformAdapter } from "./adapter";

// Spotify — solo Web API pubblica. LIMITAZIONE IMPORTANTE:
// gli "ascoltatori mensili" e gli stream NON sono esposti via API pubblica.
// Spotify for Artists API non è pubblica. Quindi qui pescheremo:
//   - follower artista
//   - popolarità (0-100)
//   - top tracks, album, uscite recenti
// L'utente aggiornerà MANUALMENTE gli ascoltatori mensili dall'UI
// (campo in ArtistProfile.goals o modello dedicato in una milestone successiva).
//
// Milestone: M4.
//
// OAuth Client Credentials basterebbe per dati pubblici, ma usiamo Authorization
// Code per poter estendere facilmente in futuro (user-follow-read ecc.).
//
// Endpoints:
//  - GET https://api.spotify.com/v1/artists/{id}       → followers.total, popularity, genres
//  - GET https://api.spotify.com/v1/artists/{id}/top-tracks?market=IT
//  - GET https://api.spotify.com/v1/artists/{id}/albums?limit=10&include_groups=album,single

export const spotifyAdapter: PlatformAdapter = {
  platform: "SPOTIFY",

  async syncMetrics() {
    throw new NotImplementedYet("SPOTIFY", "syncMetrics");
  },

  async syncRecentPosts() {
    // Per Spotify "post" = "uscite" (album/single). Mappiamo albums → Post.
    throw new NotImplementedYet("SPOTIFY", "syncRecentPosts");
  },

  async syncAudience() {
    // Non disponibile via Web API. Sempre null.
    return null;
  },
};
