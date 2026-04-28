import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { suggestTrends } from "./trends";

describe("suggestTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("parsa l'output del tool propose_trends e ritorna i trend validati", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "propose_trends",
          input: {
            trends: [
              {
                kind: "SOUND",
                name: "Sound trap italiano X",
                description: "Beat con campionamento di un pezzo classico napoletano.",
                platforms: ["TIKTOK", "INSTAGRAM"],
                expiresInDays: 14,
              },
              {
                kind: "FORMAT",
                name: "Studio session in 30 secondi",
                description: "Time-lapse della creazione di una traccia.",
                platforms: ["INSTAGRAM"],
                expiresInDays: 21,
              },
              // Filtrato: kind invalido
              {
                kind: "INVALID_KIND",
                name: "x",
                description: "y",
                platforms: ["TIKTOK"],
                expiresInDays: 10,
              },
            ],
          },
        },
      ],
    });

    const project = {
      id: "p1",
      kind: "ARTIST" as const,
      niche: "trap",
      displayName: "Test Artist",
    };
    const result = await suggestTrends(project, "SOUND", 5);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      kind: "SOUND",
      name: "Sound trap italiano X",
      platforms: ["TIKTOK", "INSTAGRAM"],
      expiresInDays: 14,
    });
    expect(result[1]).toMatchObject({
      kind: "FORMAT",
      platforms: ["INSTAGRAM"],
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0]?.[0] as {
      tool_choice: unknown;
      messages: Array<{ content: string }>;
    };
    expect(call.tool_choice).toEqual({ type: "tool", name: "propose_trends" });
    expect(call.messages[0]?.content).toContain("Test Artist");
    expect(call.messages[0]?.content).toContain("ARTIST");
    expect(call.messages[0]?.content).toContain("nicchia trap");
    expect(call.messages[0]?.content).toContain("SOUND");
  });
});
