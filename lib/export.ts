import type { Draft, Suggestion } from "@prisma/client";

const CSV_NEWLINE = "\r\n"; // RFC 4180

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const DRAFT_CSV_HEADERS = [
  "id",
  "platform",
  "contentType",
  "status",
  "scheduledFor",
  "caption",
  "hashtags",
  "mediaNotes",
  "createdAt",
  "updatedAt",
] as const;

export function draftsToCsv(drafts: Draft[]): string {
  const rows = [DRAFT_CSV_HEADERS.join(",")];
  for (const d of drafts) {
    rows.push(
      [
        csvEscape(d.id),
        csvEscape(d.platform),
        csvEscape(d.contentType),
        csvEscape(d.status),
        csvEscape(d.scheduledFor?.toISOString() ?? ""),
        csvEscape(d.caption),
        csvEscape(d.hashtags.join(" ")),
        csvEscape(d.mediaNotes ?? ""),
        csvEscape(d.createdAt.toISOString()),
        csvEscape(d.updatedAt.toISOString()),
      ].join(","),
    );
  }
  return rows.join(CSV_NEWLINE) + CSV_NEWLINE;
}

const SUGGESTION_CSV_HEADERS = [
  "id",
  "forDate",
  "platform",
  "contentType",
  "hook",
  "caption",
  "hashtags",
  "cta",
  "suggestedTime",
  "rationale",
  "status",
  "campaignId",
] as const;

export function suggestionsToCsv(suggestions: Suggestion[]): string {
  const rows = [SUGGESTION_CSV_HEADERS.join(",")];
  for (const s of suggestions) {
    rows.push(
      [
        csvEscape(s.id),
        csvEscape(s.forDate.toISOString().slice(0, 10)),
        csvEscape(s.platform),
        csvEscape(s.contentType),
        csvEscape(s.hook),
        csvEscape(s.caption),
        csvEscape(s.hashtags.join(" ")),
        csvEscape(s.cta ?? ""),
        csvEscape(s.suggestedTime ?? ""),
        csvEscape(s.rationale ?? ""),
        csvEscape(s.status),
        csvEscape(s.campaignId ?? ""),
      ].join(","),
    );
  }
  return rows.join(CSV_NEWLINE) + CSV_NEWLINE;
}

// ---- iCalendar (RFC 5545) ----------------------------------------------
//
// Generiamo un VCALENDAR con un VEVENT per ogni Draft schedulato e per ogni
// Suggestion (1 ora di durata di default; se suggestedTime mancante, all-day).
// Compatibile con Google Calendar, Apple Calendar, Outlook.

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  // RFC 5545: linee max 75 ottetti, continuazione con CRLF + spazio
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75));
    i += 75;
  }
  return chunks.join("\r\n ");
}

function fmtUtc(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function fmtDate(d: Date): string {
  // YYYYMMDD (all-day)
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  url?: string;
}

function eventBlock(e: IcsEvent): string {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${fmtUtc(new Date())}`];
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(e.start)}`);
    if (e.end) lines.push(`DTEND;VALUE=DATE:${fmtDate(e.end)}`);
  } else {
    lines.push(`DTSTART:${fmtUtc(e.start)}`);
    lines.push(`DTEND:${fmtUtc(e.end ?? new Date(e.start.getTime() + 60 * 60 * 1000))}`);
  }
  lines.push(`SUMMARY:${icsEscape(e.summary)}`);
  lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push("END:VEVENT");
  return lines.map(fold).join("\r\n");
}

export interface CalendarPayload {
  drafts: Draft[];
  suggestions: Suggestion[];
  appUrl: string;
}

export function buildICalendar({
  drafts,
  suggestions,
  appUrl,
}: CalendarPayload): string {
  const events: IcsEvent[] = [];

  for (const d of drafts) {
    if (!d.scheduledFor) continue;
    events.push({
      uid: `draft-${d.id}@smm-studio`,
      summary: `[BOZZA · ${d.platform}] ${truncate(d.caption, 60)}`,
      description: [
        d.caption,
        "",
        d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
        d.mediaNotes ? `\nNote: ${d.mediaNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      start: d.scheduledFor,
      end: new Date(d.scheduledFor.getTime() + 60 * 60 * 1000),
      url: `${appUrl}/bozze/${d.id}`,
    });
  }

  for (const s of suggestions) {
    const start = applyTimeToDate(s.forDate, s.suggestedTime);
    events.push({
      uid: `suggestion-${s.id}@smm-studio`,
      summary: `[SUGG · ${s.platform}] ${truncate(s.hook, 60)}`,
      description: [
        s.hook,
        "",
        s.caption,
        "",
        s.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
        s.cta ? `\nCTA: ${s.cta}` : "",
        s.rationale ? `\n${s.rationale}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      start,
      allDay: !s.suggestedTime,
      end: s.suggestedTime
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : new Date(start.getTime() + 24 * 60 * 60 * 1000),
      url: `${appUrl}/suggerimenti`,
    });
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SMM Studio//IT//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:SMM Studio — piano editoriale`,
    `X-WR-TIMEZONE:Europe/Rome`,
    ...events.map(eventBlock),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

function applyTimeToDate(date: Date, hhmm: string | null | undefined): Date {
  if (!hhmm) {
    // mezzogiorno per evitare drift di timezone in all-day
    const d = new Date(date);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }
  // Validazione strict: HH 00-23, MM 00-59
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return date;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  // L'orario indicato è "ora locale Europe/Rome". Convertiamolo in UTC tenendo
  // conto di CET (UTC+1, inverno) vs CEST (UTC+2, estate). DST in Italia parte
  // l'ultima domenica di marzo e finisce l'ultima domenica di ottobre.
  const offsetMin = romeOffsetMinutes(date);
  // costruiamo il timestamp UTC equivalente all'ora locale specificata
  const utcMs =
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute) -
    offsetMin * 60 * 1000;
  return new Date(utcMs);
}

/**
 * Ritorna l'offset di Europe/Rome rispetto a UTC in minuti per la data passata.
 * Usa Intl.DateTimeFormat (presente in tutti i runtime Node 18+) — il giudizio
 * DST è gestito dal motore, non da hardcoding.
 */
function romeOffsetMinutes(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    timeZoneName: "shortOffset",
    hour12: false,
  });
  // Cerca un token come "GMT+1" o "GMT+2"
  const parts = fmt.formatToParts(d);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tz);
  if (!m) return 60; // fallback CET
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = m[3] ? Number(m[3]) : 0;
  return sign * (hours * 60 + minutes);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
