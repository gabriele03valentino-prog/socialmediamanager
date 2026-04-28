// Email transazionale via Resend.
// Tutto opzionale: se mancano `RESEND_API_KEY` e `EMAIL_FROM` la funzione
// è un no-op silenzioso (log warn in dev). Questo evita di bloccare il cron
// se l'utente non ha (ancora) configurato l'account Resend.

import { Resend } from "resend";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  skipped?: "no_api_key" | "no_from" | "no_to";
  error?: string;
  id?: string;
}

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (client) return client;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  if (!getClient()) return { ok: false, skipped: "no_api_key" };
  if (!from) return { ok: false, skipped: "no_from" };
  if (!to) return { ok: false, skipped: "no_to" };

  try {
    const resp = await getClient()!.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });
    if (resp.error) {
      return { ok: false, error: resp.error.message ?? "send_error" };
    }
    return { ok: true, id: resp.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface DailyFeedbackPayload {
  artistName: string;
  forDate: Date;
  headline: string;
  body: string;
  postsCount: number;
  appUrl: string;
}

export async function sendDailyFeedbackEmail(
  to: string,
  payload: DailyFeedbackPayload,
): Promise<SendResult> {
  const subject = `[SMM Studio] ${payload.headline}`;
  const dateLabel = payload.forDate.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
  });
  const html = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <p style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.04em;">
        Feedback del ${dateLabel} · ${payload.postsCount} post
      </p>
      <h1 style="font-size: 20px; margin: 6px 0 14px;">${escapeHtml(payload.headline)}</h1>
      <div style="font-size: 15px; line-height: 1.5; white-space: pre-wrap;">
        ${escapeHtml(payload.body)}
      </div>
      <p style="margin-top: 24px;">
        <a href="${payload.appUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          Apri SMM Studio
        </a>
      </p>
      <p style="font-size: 11px; color: #999; margin-top: 32px;">
        Ricevi questa mail perché hai un account su SMM Studio. Per disattivarla
        rimuovi <code>EMAIL_FROM</code> dalle env del deploy.
      </p>
    </div>
  `;
  const text = `${payload.headline}\n\n${payload.body}\n\nApri: ${payload.appUrl}`;
  return sendEmail({ to, subject, html, text });
}

export interface AggregatedDailyFeedbackPayload {
  forDate: Date;
  appUrl: string;
  projects: Array<{
    displayName: string;
    kind: string;
    headline: string;
    body: string;
    postsCount: number;
  }>;
}

export async function sendAggregatedDailyFeedbackEmail(
  to: string,
  payload: AggregatedDailyFeedbackPayload,
): Promise<SendResult> {
  const dateLabel = payload.forDate.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
  });
  const count = payload.projects.length;
  const subject = `[SMM Studio] Feedback ${dateLabel} — ${count} ${count === 1 ? "progetto" : "progetti"}`;

  const sections = payload.projects
    .map(
      (p) => `
    <div style="border-top: 1px solid #eee; padding-top: 18px; margin-top: 18px;">
      <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin: 0;">
        ${escapeHtml(p.kind)} · ${p.postsCount} post
      </p>
      <h2 style="font-size: 17px; margin: 6px 0 4px;">${escapeHtml(p.displayName)}</h2>
      <p style="font-size: 14px; color: #555; margin: 0 0 8px;">${escapeHtml(p.headline)}</p>
      <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap; color: #222;">
        ${escapeHtml(p.body)}
      </div>
    </div>
  `,
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <p style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.04em;">
        I tuoi progetti — ${dateLabel}
      </p>
      <h1 style="font-size: 22px; margin: 6px 0 4px;">Feedback giornaliero</h1>
      ${sections}
      <p style="margin-top: 28px;">
        <a href="${payload.appUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          Apri SMM Studio
        </a>
      </p>
      <p style="font-size: 11px; color: #999; margin-top: 32px;">
        Disattiva l'email per un singolo progetto da Impostazioni progetto.
      </p>
    </div>
  `;
  const text = payload.projects
    .map((p) => `## ${p.displayName} (${p.kind})\n${p.headline}\n\n${p.body}`)
    .join("\n\n---\n\n");

  return sendEmail({ to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
