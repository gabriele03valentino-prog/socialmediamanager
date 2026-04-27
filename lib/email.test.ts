import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendEmail } from "./email";

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
