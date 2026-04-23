import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const GENRES = [
  "trap",
  "drill",
  "rap",
  "pop urban",
  "pop",
  "cantautorato",
  "indie",
  "house",
  "techno",
  "elettronica",
  "reggaeton",
  "r&b",
  "altro",
];

export default async function ProfiloPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });
  const goals = (profile?.goals ?? {}) as {
    targetFollowersIG?: number;
    targetByDate?: string;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Profilo artista</h1>
        <p className="text-sm text-neutral-500">
          Queste informazioni vanno in pasto al motore di suggerimenti. Più sono
          precise, migliori sono i consigli.
        </p>
      </header>

      <form
        action="/api/artist-profile"
        method="POST"
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div>
          <label className="block text-sm font-medium">Stage name</label>
          <input
            name="stageName"
            defaultValue={profile?.stageName ?? ""}
            required
            maxLength={80}
            placeholder="es. Marracash"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Genere</label>
          <input
            name="genre"
            list="genres"
            defaultValue={profile?.genre ?? ""}
            required
            maxLength={80}
            placeholder="es. trap, drill, house"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
          <datalist id="genres">
            {GENRES.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Città</label>
            <input
              name="city"
              defaultValue={profile?.city ?? ""}
              maxLength={80}
              placeholder="es. Milano"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Sito / link</label>
            <input
              name="websiteUrl"
              type="url"
              defaultValue={profile?.websiteUrl ?? ""}
              placeholder="https://linktr.ee/..."
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Bio / mission</label>
          <textarea
            name="bio"
            defaultValue={profile?.bio ?? ""}
            maxLength={2000}
            rows={4}
            placeholder="Descriviti in 3-4 righe: sound, tipo di release, cosa vuoi comunicare."
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>

        <fieldset className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">Obiettivo (opzionale)</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500">
                Follower IG da raggiungere
              </label>
              <input
                name="targetFollowersIG"
                type="number"
                min={0}
                defaultValue={goals.targetFollowersIG ?? ""}
                placeholder="es. 10000"
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Entro il</label>
              <input
                name="targetByDate"
                type="date"
                defaultValue={goals.targetByDate ?? ""}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Salva profilo
        </button>
      </form>
    </div>
  );
}
