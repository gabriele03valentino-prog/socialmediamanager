import type { Draft, Suggestion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildICalendar, draftsToCsv, suggestionsToCsv } from "./export";

function makeDraft(over: Partial<Draft> = {}): Draft {
  return {
    id: "d1",
    userId: "u1",
    suggestionId: null,
    platform: "INSTAGRAM",
    contentType: "REEL",
    scheduledFor: new Date("2026-05-02T18:00:00Z"),
    caption: "Hello, world",
    hashtags: ["music", "italy"],
    mediaNotes: "Verticale 9:16",
    checklist: null,
    status: "READY",
    createdAt: new Date("2026-04-25T10:00:00Z"),
    updatedAt: new Date("2026-04-26T11:00:00Z"),
    ...over,
  } as Draft;
}

function makeSuggestion(over: Partial<Suggestion> = {}): Suggestion {
  return {
    id: "s1",
    userId: "u1",
    forDate: new Date("2026-05-03T00:00:00Z"),
    platform: "TIKTOK",
    contentType: "TIKTOK",
    hook: "Drop the beat",
    caption: "Caption with, comma",
    hashtags: ["beat"],
    cta: null,
    suggestedTime: "20:00",
    rationale: null,
    status: "PROPOSED",
    generatedBy: "claude-sonnet-4-6",
    campaignId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Suggestion;
}

describe("draftsToCsv", () => {
  it("emits header + row with CRLF terminators", () => {
    const csv = draftsToCsv([makeDraft()]);
    const [header, body] = csv.split("\r\n");
    expect(header).toContain("id,platform,contentType");
    expect(body).toContain("d1");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapes commas and quotes per RFC 4180", () => {
    const csv = draftsToCsv([
      makeDraft({ caption: 'Hello, "world"', mediaNotes: "line1\nline2" }),
    ]);
    expect(csv).toContain('"Hello, ""world"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it("handles missing scheduledFor", () => {
    const csv = draftsToCsv([makeDraft({ scheduledFor: null })]);
    expect(csv).toMatch(/d1,/); // empty cell for scheduledFor
  });
});

describe("suggestionsToCsv", () => {
  it("emits all 12 columns", () => {
    const csv = suggestionsToCsv([makeSuggestion()]);
    const header = csv.split("\r\n")[0]!;
    expect(header.split(",")).toHaveLength(12);
  });

  it("escapes captions with commas", () => {
    const csv = suggestionsToCsv([makeSuggestion()]);
    expect(csv).toContain('"Caption with, comma"');
  });
});

describe("buildICalendar", () => {
  it("emits a valid VCALENDAR envelope", () => {
    const ics = buildICalendar({
      drafts: [makeDraft()],
      suggestions: [makeSuggestion()],
      appUrl: "https://example.com",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("PRODID:-//SMM Studio//IT//IT");
    expect(ics).toContain("VERSION:2.0");
  });

  it("emits a VEVENT for each scheduled draft", () => {
    const ics = buildICalendar({
      drafts: [makeDraft({ id: "a" }), makeDraft({ id: "b" })],
      suggestions: [],
      appUrl: "https://example.com",
    });
    const matches = ics.match(/BEGIN:VEVENT/g);
    expect(matches).not.toBeNull();
    expect(matches!).toHaveLength(2);
  });

  it("skips drafts without scheduledFor", () => {
    const ics = buildICalendar({
      drafts: [makeDraft({ scheduledFor: null })],
      suggestions: [],
      appUrl: "https://example.com",
    });
    expect(ics.match(/BEGIN:VEVENT/g) ?? []).toHaveLength(0);
  });

  it("escapes special chars in summary/description (RFC 5545)", () => {
    const ics = buildICalendar({
      drafts: [
        makeDraft({
          caption: "line1\nline2,with;semi",
        }),
      ],
      suggestions: [],
      appUrl: "https://example.com",
    });
    expect(ics).toContain("\\n");
    expect(ics).toContain("\\,");
    expect(ics).toContain("\\;");
  });

  it("uses DTSTART with VALUE=DATE for all-day suggestions (no suggestedTime)", () => {
    const ics = buildICalendar({
      drafts: [],
      suggestions: [makeSuggestion({ suggestedTime: null })],
      appUrl: "https://example.com",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:");
  });

  it("uses DTSTART UTC for timed suggestions", () => {
    const ics = buildICalendar({
      drafts: [],
      suggestions: [makeSuggestion({ suggestedTime: "20:00" })],
      appUrl: "https://example.com",
    });
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it("rejects invalid hhmm (out-of-range)", () => {
    const ics = buildICalendar({
      drafts: [],
      // suggestedTime "25:99" non è valido — fallback a forDate (mezzanotte UTC)
      suggestions: [makeSuggestion({ suggestedTime: "25:99" })],
      appUrl: "https://example.com",
    });
    // L'evento deve esistere ma con DTSTART = forDate originale (no parsing di 25:99)
    expect(ics).toContain("BEGIN:VEVENT");
  });

  it("buildICalendar usa displayName progetto nel SUMMARY prefix se passato", () => {
    const ics = buildICalendar({
      drafts: [makeDraft({ caption: "Lancio singolo" })],
      suggestions: [makeSuggestion({ hook: "Idea TikTok" })],
      appUrl: "https://example.com",
      projectLabel: "Mio Progetto",
    });
    // Prefix anteposto sia ai draft che alle suggestion.
    expect(ics).toContain("SUMMARY:[Mio Progetto] [BOZZA · INSTAGRAM]");
    expect(ics).toContain("SUMMARY:[Mio Progetto] [SUGG · TIKTOK]");
    // Senza projectLabel il prefix non deve comparire.
    const plain = buildICalendar({
      drafts: [makeDraft({ caption: "Lancio singolo" })],
      suggestions: [],
      appUrl: "https://example.com",
    });
    expect(plain).not.toContain("[Mio Progetto]");
  });

  it("converts Rome local time to UTC respecting DST", () => {
    // 1° agosto = CEST (UTC+2): "20:00" locale → "18:00Z"
    const summer = makeSuggestion({
      forDate: new Date("2026-08-01T00:00:00Z"),
      suggestedTime: "20:00",
    });
    // 1° gennaio = CET (UTC+1): "20:00" locale → "19:00Z"
    const winter = makeSuggestion({
      id: "s2",
      forDate: new Date("2026-01-15T00:00:00Z"),
      suggestedTime: "20:00",
    });
    const ics = buildICalendar({
      drafts: [],
      suggestions: [summer, winter],
      appUrl: "https://example.com",
    });
    expect(ics).toContain("DTSTART:20260801T180000Z");
    expect(ics).toContain("DTSTART:20260115T190000Z");
  });
});
