import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the supabase client BEFORE importing the hook
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

import { useRolePermissions, VIEW_PERMISSION_MAP } from "./useRolePermissions";

describe("useRolePermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("owner can access every mapped view", async () => {
    const { result } = renderHook(() => useRolePermissions("owner", "loc-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    for (const view of Object.keys(VIEW_PERMISSION_MAP)) {
      expect(result.current.canAccessView(view)).toBe(true);
    }
  });

  it("manager can access menu (case 7)", async () => {
    const { result } = renderHook(() => useRolePermissions("manager", "loc-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.canAccessView("products")).toBe(true);
  });

  it("sales cannot access settings (case 5)", async () => {
    const { result } = renderHook(() => useRolePermissions("sales", "loc-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.canAccessView("settings")).toBe(false);
  });

  it("sales cannot access analytics by default (case 6)", async () => {
    const { result } = renderHook(() => useRolePermissions("sales", "loc-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.canAccessView("dashboard")).toBe(false);
    expect(result.current.canAccessView("verkoop")).toBe(false);
  });

  it("sales CAN access pos (default grant)", async () => {
    const { result } = renderHook(() => useRolePermissions("sales", "loc-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.canAccessView("pos")).toBe(true);
  });
});
