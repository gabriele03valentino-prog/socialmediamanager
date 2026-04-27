import { describe, it, expect, beforeEach } from "vitest";
import { signProjectCookie, verifyProjectCookie } from "./active-project";

describe("active-project cookie HMAC", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test_secret_for_unit_tests_only_xxxxx";
  });

  it("signProjectCookie produce stringa formato projectId.hmac", () => {
    const cookie = signProjectCookie("proj_abc");
    expect(cookie).toMatch(/^proj_abc\.[a-f0-9]+$/);
  });

  it("verifyProjectCookie ritorna projectId per cookie valido", () => {
    const cookie = signProjectCookie("proj_abc");
    expect(verifyProjectCookie(cookie)).toBe("proj_abc");
  });

  it("verifyProjectCookie ritorna null se HMAC tampered", () => {
    const cookie = signProjectCookie("proj_abc");
    const tampered = cookie.replace(/.$/, "0");
    expect(verifyProjectCookie(tampered)).toBeNull();
  });

  it("verifyProjectCookie ritorna null se projectId tampered", () => {
    const cookie = signProjectCookie("proj_abc");
    const parts = cookie.split(".");
    const tampered = `proj_xyz.${parts[1]}`;
    expect(verifyProjectCookie(tampered)).toBeNull();
  });

  it("verifyProjectCookie ritorna null se formato invalido", () => {
    expect(verifyProjectCookie("garbage")).toBeNull();
    expect(verifyProjectCookie("")).toBeNull();
    expect(verifyProjectCookie("proj_abc")).toBeNull();
  });
});
