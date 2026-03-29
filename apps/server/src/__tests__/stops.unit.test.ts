import { describe, it, expect } from "vitest";
import { deduplicateStops, type RawStop } from "../services/overpass";

describe("deduplicateStops", () => {
  it("merges stops with the same name within threshold", () => {
    const stops: RawStop[] = [
      { osmId: 1, name: "Rynek Główny", lat: 50.0615, lng: 19.9370 },
      { osmId: 2, name: "Rynek Główny", lat: 50.0617, lng: 19.9375 },
      { osmId: 3, name: "Rynek Główny", lat: 50.0613, lng: 19.9368 },
    ];

    const result = deduplicateStops(stops);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rynek Główny");
    // Average of the three
    expect(result[0].lat).toBeCloseTo(50.0615, 4);
    expect(result[0].lng).toBeCloseTo(19.9371, 3);
  });

  it("keeps stops with different names separate", () => {
    const stops: RawStop[] = [
      { osmId: 1, name: "Rynek Główny", lat: 50.0615, lng: 19.9370 },
      { osmId: 2, name: "Dworzec Główny", lat: 50.0670, lng: 19.9450 },
    ];

    const result = deduplicateStops(stops);
    expect(result).toHaveLength(2);
  });

  it("keeps same-name stops far apart as separate", () => {
    const stops: RawStop[] = [
      { osmId: 1, name: "Plac Centralny", lat: 50.0615, lng: 19.9370 },
      { osmId: 2, name: "Plac Centralny", lat: 50.0700, lng: 19.9500 }, // ~1km away
    ];

    const result = deduplicateStops(stops);
    expect(result).toHaveLength(2);
  });

  it("handles empty array", () => {
    expect(deduplicateStops([])).toEqual([]);
  });

  it("handles single stop", () => {
    const stops: RawStop[] = [{ osmId: 1, name: "Test", lat: 50.0, lng: 19.0 }];
    const result = deduplicateStops(stops);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test");
  });

  it("is case-insensitive when grouping names", () => {
    const stops: RawStop[] = [
      { osmId: 1, name: "Rynek Główny", lat: 50.0615, lng: 19.9370 },
      { osmId: 2, name: "rynek główny", lat: 50.0616, lng: 19.9371 },
    ];

    const result = deduplicateStops(stops);
    expect(result).toHaveLength(1);
  });

  it("skips unnamed stops (already filtered by fetchStopsFromOverpass)", () => {
    const stops: RawStop[] = [
      { osmId: 1, name: "A", lat: 50.0, lng: 19.0 },
      { osmId: 2, name: "B", lat: 50.1, lng: 19.1 },
    ];
    const result = deduplicateStops(stops);
    expect(result).toHaveLength(2);
  });
});
