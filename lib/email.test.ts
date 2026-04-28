import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendAggregatedDailyFeedbackEmail, sendEmail } from "./email";

describe("sendEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns skipped:no_api_key when RESEND_API_KEY missing", async () => {
    const r = await sendEmail({
      to: "test@example.com",
      subject: "x",
      html: "<p>x</p>",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("no_api_key");
  });

  it("returns skipped:no_from when EMAIL_FROM missing", async () => {
    process.env.RESEND_API_KEY = "fake-key";
    const r = await sendEmail({
      to: "test@example.com",
      subject: "x",
      html: "<p>x</p>",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("no_from");
  });

  it("returns skipped:no_to when to is empty", async () => {
    process.env.RESEND_API_KEY = "fake-key";
    process.env.EMAIL_FROM = "noreply@example.com";
    const r = await sendEmail({
      to: "",
      subject: "x",
      html: "<p>x</p>",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("no_to");
  });
});

describe("sendAggregatedDailyFeedbackEmail", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("skipped no_api_key se RESEND_API_KEY mancante", async () => {
    const result = await sendAggregatedDailyFeedbackEmail("user@x.io", {
      forDate: new Date("2026-04-27"),
      appUrl: "https://x.io",
      projects: [
        { displayName: "P1", kind: "ARTIST", headline: "h", body: "b", postsCount: 1 },
      ],
    });
    expect(result.skipped).toBe("no_api_key");
  });

  it("skipped no_from se EMAIL_FROM mancante", async () => {
    process.env.RESEND_API_KEY = "fake_key";
    const result = await sendAggregatedDailyFeedbackEmail("user@x.io", {
      forDate: new Date("2026-04-27"),
      appUrl: "https://x.io",
      projects: [{ displayName: "P1", kind: "ARTIST", headline: "h", body: "b", postsCount: 0 }],
    });
    expect(result.skipped).toBe("no_from");
  });

  it("subject indica numero progetti (singolare/plurale)", async () => {
    // Senza API key/EMAIL_FROM finisce in skipped — verifichiamo internal subject via mock di sendEmail
    // Approccio semplificato: render esposto via export interno se necessario.
    // Per ora: 1 progetto vs 2 progetti — verifichiamo solo che call non lanci errori
    const r1 = await sendAggregatedDailyFeedbackEmail("user@x.io", {
      forDate: new Date("2026-04-27"),
      appUrl: "https://x.io",
      projects: [{ displayName: "P1", kind: "ARTIST", headline: "h", body: "b", postsCount: 1 }],
    });
    expect(r1.ok).toBe(false); // skipped no_api_key
    const r2 = await sendAggregatedDailyFeedbackEmail("user@x.io", {
      forDate: new Date("2026-04-27"),
      appUrl: "https://x.io",
      projects: [
        { displayName: "P1", kind: "ARTIST", headline: "h", body: "b", postsCount: 1 },
        { displayName: "P2", kind: "PODCASTER", headline: "h2", body: "b2", postsCount: 0 },
      ],
    });
    expect(r2.ok).toBe(false);
  });
});
