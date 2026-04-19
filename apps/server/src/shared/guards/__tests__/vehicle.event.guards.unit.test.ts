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

    delete invalidEvent[key as keyof typeof validEvent];

    expect(isStatusChangeEvent(invalidEvent)).toBe(false);
  });

  it("should return false if lat or lng is NaN", () => {
    expect(isStatusChangeEvent({ ...validEvent, lat: NaN })).toBe(false);
    expect(isStatusChangeEvent({ ...validEvent, lng: Number.NaN })).toBe(false);
  });

  it("should return false if lat or lng is Infinity", () => {
    expect(isStatusChangeEvent({ ...validEvent, lat: Infinity })).toBe(false);
    expect(isStatusChangeEvent({ ...validEvent, lng: -Infinity })).toBe(false);
  });

  it("should return true for valid finite numbers including 0", () => {
    expect(isStatusChangeEvent({ ...validEvent, lat: 0, lng: 0 })).toBe(true);
  });

  it("should return false if string fields are not strings", () => {
    expect(isStatusChangeEvent({ ...validEvent, vehicleId: 123 })).toBe(false);
    expect(isStatusChangeEvent({ ...validEvent, timestamp: new Date() })).toBe(false);
  });
});
