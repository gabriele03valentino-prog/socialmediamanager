import { z } from "zod";
import { anthropic, MARKETING_MODEL } from "./claude";
import { MARKETING_SYSTEM_BLOCKS } from "./prompts";

export interface PersonaInput {
  artist: {
    stageName: string;
    genre: string;
    city?: string | null;
    bio?: string | null;
  };
  // Se l'utente ha dati demografici reali (audience insights IG/YT) li passiamo qui.
  audienceData?: Record<string, unknown>;
  goals?: unknown;
}

const PersonaSchema = z.object({
  name: z.string().min(1).max(60),
  ageRange: z.string().min(3).max(20),
  location: z.string().min(1).max(80),
  occupation: z.string().min(1).max(120),
  musicHabits: z.string().min(20).max(600),
  platforms: z.array(z.string()).min(1).max(5),
  listeningTimes: z.string().max(160).optional(),
  triggers: z.array(z.string()).min(2).max(6),
  culturalRefs: z.array(z.string()).min(2).max(8),
});
export type PersonaProposal = z.infer<typeof PersonaSchema>;

const PersonasSchema = z.object({
  personas: z.array(PersonaSchema).min(2).max(3),
});

const TOOL = {
  name: "generate_audience_personas",
  description:
    "Costruisci 2-3 persona archetipiche dell'audience target dell'artista, usando i dati reali se presenti altrimenti ragionando sul genere + città + bio.",
  input_schema: {
    type: "object",
    required: ["personas"],
    properties: {
      personas: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          required: [
            "name",
            "ageRange",
            "location",
            "occupation",
            "musicHabits",
            "platforms",
            "triggers",
            "culturalRefs",
          ],
          properties: {
            name: {
              type: "string",
              description:
                "Nome proprio di fantasia (es. 'Luca 21' o 'Giulia la notturna')",
            },
            ageRange: {
              type: "string",
              description: "Es. '18-24'",
            },
            location: {
              type: "string",
              description: "Città o macro-area (es. 'Milano hinterland', 'Sud Italia')",
            },
            occupation: {
              type: "string",
              description: "Es. 'Studente universitario Bocconi', 'Rider + studente'",
            },
            musicHabits: {
              type: "string",
              description:
                "Cosa ascolta, come scopre nuova musica, rituali (palestra, macchina, cuffie al lavoro), atteggiamento verso generi vicini",
            },
            platforms: {
              type: "array",
              items: { type: "string" },
              description:
                "Le piattaforme dove è più raggiungibile, ordinate per priorità (es. ['TikTok', 'Instagram Reels', 'Spotify'])",
            },
            listeningTimes: {
              type: "string",
              description:
                "Fasce orarie chiave per attivarlo (es. 'lun-ven 18-21, weekend 23-03')",
            },
            triggers: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 6,
              description:
                "Trigger che funzionano con questa persona: 'drop snippet venerdì sera', 'BTS studio con dettaglio tecnico', 'duet con nomi della scena locale', ecc.",
            },
            culturalRefs: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 8,
              description:
                "Riferimenti culturali specifici: meme italiani di nicchia, micro-influencer seguiti, serie TV, brand, eventi",
            },
          },
        },
      },
    },
  },
} as const;

export async function generatePersonas(input: PersonaInput): Promise<PersonaProposal[]> {
  const userMessage = `Costruisci 2-3 persona dell'audience target per questo artista:

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

Regole:
- Le persona devono essere **distinte tra loro**: non 3 varianti dello stesso fan, ma 3 segmenti con abitudini/leve diverse.
- Se non hai dati reali, usa statistiche plausibili di mercato IT del genere indicato.
- I trigger devono essere **azionabili**: "posta BTS studio giovedì alle 21" è buono, "fai contenuti autentici" non lo è.
- I culturalRefs devono essere **specifici al contesto italiano** (meme reali, influencer reali o archetipi riconoscibili).`;

  const response = await anthropic().messages.create({
    model: MARKETING_MODEL,
    max_tokens: 3000,
    system: MARKETING_SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude non ha chiamato il tool generate_audience_personas");
  const parsed = PersonasSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output non valido: ${parsed.error.message}`);
  }
  return parsed.data.personas;
}
