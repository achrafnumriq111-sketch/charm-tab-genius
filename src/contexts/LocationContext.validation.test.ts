import { describe, it, expect } from "vitest";

/**
 * Case 12: When activeLocationId points to a location the user can no longer
 * see (revoked, deleted, tenant switch), LocationContext must auto-reset to
 * the first valid location. We test the pure decision logic copied from
 * LocationContext.fetchLocations to keep the contract under test without
 * mounting React + Supabase + Tenant providers.
 */
function resolveActiveId(
  stored: string | null,
  current: string | null,
  available: { id: string }[]
): string | null {
  if (available.length === 0) return null;
  const stillValid = (id: string | null) => !!id && available.some((l) => l.id === id);
  if (stillValid(current)) return current;
  if (stillValid(stored)) return stored;
  return available[0].id;
}

describe("LocationContext active-location validation", () => {
  it("keeps current id when still valid", () => {
    expect(resolveActiveId("a", "b", [{ id: "a" }, { id: "b" }])).toBe("b");
  });

  it("falls back to stored when current is stale", () => {
    expect(resolveActiveId("a", "ghost", [{ id: "a" }, { id: "b" }])).toBe("a");
  });

  it("falls back to first available when both are stale", () => {
    expect(resolveActiveId("ghost1", "ghost2", [{ id: "a" }, { id: "b" }])).toBe("a");
  });

  it("returns null when user has no locations", () => {
    expect(resolveActiveId("a", "a", [])).toBeNull();
  });
});
