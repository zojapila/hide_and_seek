import { describe, it, expect } from "vitest";

// Test the code format/charset rules (without DB dependency)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("game code format", () => {
  it("charset excludes ambiguous characters (0, O, 1, I)", () => {
    expect(CODE_CHARS).not.toContain("0");
    expect(CODE_CHARS).not.toContain("O");
    expect(CODE_CHARS).not.toContain("1");
    expect(CODE_CHARS).not.toContain("I");
  });

  it("charset has 32 characters", () => {
    expect(CODE_CHARS).toHaveLength(32);
  });

  it("charset contains only uppercase letters and digits", () => {
    expect(CODE_CHARS).toMatch(/^[A-Z0-9]+$/);
  });

  it("codes should be 6 characters long (format check)", () => {
    // Simulating what generateUniqueCode produces
    const codeRegex = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
    expect(codeRegex.test("ABC234")).toBe(true);
    expect(codeRegex.test("ZZZZZZ")).toBe(true);
    expect(codeRegex.test("abc234")).toBe(false); // lowercase
    expect(codeRegex.test("AB012")).toBe(false); // too short + has 0 and 1
    expect(codeRegex.test("ABCDEFG")).toBe(false); // too long
  });
});
