import { CopyableBlock } from "@/components/CopyableBlock";

interface PaletteColor {
  hex: string;
  role: string;
  usage: string;
}
interface Typography {
  title: { family: string; weights: string[]; rationale: string };
  body: { family: string; weights: string[]; rationale: string };
}
interface ToneOfVoice {
  adjectives: string[];
  examples: string[];
}

export interface BrandIdentityData {
  palette: PaletteColor[];
  typography: Typography;
  toneOfVoice: ToneOfVoice;
  moodKeywords: string[];
  logoBrief: string;
  logoSvg: string;
  claudeDesignPrompt: string;
  mjPrompt: string;
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export function BrandIdentityView({ data }: { data: BrandIdentityData }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Palette
        </h2>
        <div className="grid gap-3 md:grid-cols-5">
          {data.palette.map((c) => (
            <div
              key={c.hex}
              className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div
                className={`flex h-20 items-end justify-between p-2 text-xs ${
                  isLight(c.hex) ? "text-neutral-900" : "text-white"
                }`}
                style={{ backgroundColor: c.hex }}
              >
                <span className="font-mono">{c.hex}</span>
                <span className="rounded bg-black/20 px-1 py-0.5 backdrop-blur-sm">
                  {c.role}
                </span>
              </div>
              <div className="bg-white p-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                {c.usage}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Typography
          </h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-xs text-neutral-500">Titoli</div>
              <div className="text-xl font-semibold">
                {data.typography.title.family}
              </div>
              <div className="text-xs text-neutral-500">
                Pesi: {data.typography.title.weights.join(", ")}
              </div>
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                {data.typography.title.rationale}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-xs text-neutral-500">Body</div>
              <div className="text-base">{data.typography.body.family}</div>
              <div className="text-xs text-neutral-500">
                Pesi: {data.typography.body.weights.join(", ")}
              </div>
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                {data.typography.body.rationale}
              </p>
            </div>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Tono di voce
          </h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {data.toneOfVoice.adjectives.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                >
                  {a}
                </span>
              ))}
            </div>
            <div className="space-y-1">
              {data.toneOfVoice.examples.map((e, i) => (
                <p
                  key={i}
                  className="border-l-2 border-neutral-300 pl-2 text-sm italic text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
                >
                  {e}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Mood
        </h2>
        <div className="flex flex-wrap gap-2">
          {data.moodKeywords.map((m) => (
            <span
              key={m}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {m}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Logo
          </h2>
          <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div
              className="h-32 w-32 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              dangerouslySetInnerHTML={{ __html: data.logoSvg }}
            />
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {data.logoBrief}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Prompt per i tool di design
          </h2>
          <CopyableBlock
            label="Claude.ai/design"
            text={data.claudeDesignPrompt}
          />
          <CopyableBlock label="Midjourney" text={data.mjPrompt} />
        </div>
      </section>
    </div>
  );
}
