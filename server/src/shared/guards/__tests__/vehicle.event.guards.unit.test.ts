import { describe, expect, it } from "vitest";
import { isStatusChangeEvent } from "../vehicle-event.guards";

describe("isStatusChangeEvent", () => {
  const validEvent = {
    vehicleId: "v-123",
    plateNumber: "ABC-123",
    status: "active",
    lat: 51.5074,
    lng: -0.1278,
    timestamp: new Date().toISOString(),
  };

  it("should return true for a valid event object", () => {
    expect(isStatusChangeEvent(validEvent)).toBe(true);
  });

  it("should return true even if the object has extra properties", () => {
    const eventWithExtra = { ...validEvent, unknownProp: "ignore-me" };
    expect(isStatusChangeEvent(eventWithExtra)).toBe(true);
  });

  it("should return false if data is nullish", () => {
    expect(isStatusChangeEvent(null)).toBe(false);
    expect(isStatusChangeEvent(undefined)).toBe(false);
  });

  it("should return false if data is an empty object", () => {
    expect(isStatusChangeEvent({})).toBe(false);
  });

  const keys = Object.keys(validEvent);
  it.each(keys)("should return false if '%s' is missing", (key) => {
    const invalidEvent = { ...validEvent };
    delete (invalidEvent as any)[key];
    expect(isStatusChangeEvent(invalidEvent)).toBe(false);
  });

  it("should return false if lat or lng are not actual numbers", () => {
    expect(isStatusChangeEvent({ ...validEvent, lat: "51.5" })).toBe(false);
    expect(isStatusChangeEvent({ ...validEvent, lng: NaN })).toBe(false);
  });

  it("should return false if string fields are not strings", () => {
    expect(isStatusChangeEvent({ ...validEvent, vehicleId: 123 })).toBe(false);
    expect(isStatusChangeEvent({ ...validEvent, timestamp: new Date() })).toBe(
      false,
    );
  });
});
