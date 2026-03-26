import { describe, it, expect } from "vitest";
import { validateCreateGame, validateJoin } from "../routes/games";

describe("validateCreateGame", () => {
  it("returns defaults when no body provided", () => {
    const result = validateCreateGame({});
    expect(result).toEqual({
      hideTimeMinutes: 30,
      geofenceRadiusM: 200,
      gameRadiusM: 3000,
    });
  });

  it("accepts valid custom values", () => {
    const result = validateCreateGame({
      hideTimeMinutes: 60,
      geofenceRadiusM: 500,
      gameRadiusM: 5000,
    });
    expect(result).toEqual({
      hideTimeMinutes: 60,
      geofenceRadiusM: 500,
      gameRadiusM: 5000,
    });
  });

  it("accepts boundary values", () => {
    expect(validateCreateGame({ hideTimeMinutes: 5, geofenceRadiusM: 50, gameRadiusM: 500 })).toBeTruthy();
    expect(validateCreateGame({ hideTimeMinutes: 120, geofenceRadiusM: 1000, gameRadiusM: 10000 })).toBeTruthy();
  });

  it("rejects hideTimeMinutes < 5", () => {
    expect(() => validateCreateGame({ hideTimeMinutes: 4 })).toThrow();
  });

  it("rejects hideTimeMinutes > 120", () => {
    expect(() => validateCreateGame({ hideTimeMinutes: 121 })).toThrow();
  });

  it("rejects geofenceRadiusM < 50", () => {
    expect(() => validateCreateGame({ geofenceRadiusM: 49 })).toThrow();
  });

  it("rejects geofenceRadiusM > 1000", () => {
    expect(() => validateCreateGame({ geofenceRadiusM: 1001 })).toThrow();
  });

  it("rejects gameRadiusM < 500", () => {
    expect(() => validateCreateGame({ gameRadiusM: 499 })).toThrow();
  });

  it("rejects gameRadiusM > 10000", () => {
    expect(() => validateCreateGame({ gameRadiusM: 10001 })).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => validateCreateGame({ hideTimeMinutes: -10 })).toThrow();
  });

  it("rejects NaN string values", () => {
    expect(() => validateCreateGame({ hideTimeMinutes: "abc" })).toThrow();
  });
});

describe("validateJoin", () => {
  it("accepts valid name and role=hider", () => {
    const result = validateJoin({ name: "Zosia", role: "hider" });
    expect(result).toEqual({ name: "Zosia", role: "hider" });
  });

  it("accepts valid name and role=seeker", () => {
    const result = validateJoin({ name: "Kacper", role: "seeker" });
    expect(result).toEqual({ name: "Kacper", role: "seeker" });
  });

  it("trims name whitespace", () => {
    const result = validateJoin({ name: "  Ala  ", role: "hider" });
    expect(result.name).toBe("Ala");
  });

  it("rejects empty name", () => {
    expect(() => validateJoin({ name: "", role: "hider" })).toThrow();
  });

  it("rejects whitespace-only name", () => {
    expect(() => validateJoin({ name: "   ", role: "hider" })).toThrow();
  });

  it("rejects name > 50 chars", () => {
    expect(() => validateJoin({ name: "a".repeat(51), role: "hider" })).toThrow();
  });

  it("accepts name exactly 50 chars", () => {
    const result = validateJoin({ name: "a".repeat(50), role: "seeker" });
    expect(result.name).toHaveLength(50);
  });

  it("rejects invalid role", () => {
    expect(() => validateJoin({ name: "Test", role: "invalid" })).toThrow();
  });

  it("rejects empty role", () => {
    expect(() => validateJoin({ name: "Test", role: "" })).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() => validateJoin({})).toThrow();
  });
});
