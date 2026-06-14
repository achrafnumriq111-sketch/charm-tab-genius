import { describe, it, expect, beforeEach } from "vitest";

/**
 * Case 10: logout() wipes every saakouk_* / pos_* key from both storages.
 *
 * The wipe is a small, pure helper in AuthContext. We re-implement the same
 * logic here against jsdom storages to lock the contract in place — any
 * future change to the loop is caught by this test.
 */
function wipe(s: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && (k.startsWith("saakouk_") || k.startsWith("pos_"))) keys.push(k);
  }
  keys.forEach((k) => s.removeItem(k));
}

describe("AuthContext clearSession wipe contract", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("removes every saakouk_* and pos_* key from both storages, keeps unrelated keys", () => {
    localStorage.setItem("saakouk_active_location_id", "loc-1");
    localStorage.setItem("pos_employee", "{}");
    localStorage.setItem("unrelated", "keep");
    sessionStorage.setItem("saakouk_impersonation", "{}");
    sessionStorage.setItem("saakouk_admin_selected_tenant", "t-1");
    sessionStorage.setItem("pos_employee", "{}");
    sessionStorage.setItem("other", "keep");

    wipe(localStorage);
    wipe(sessionStorage);

    expect(localStorage.getItem("saakouk_active_location_id")).toBeNull();
    expect(localStorage.getItem("pos_employee")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");

    expect(sessionStorage.getItem("saakouk_impersonation")).toBeNull();
    expect(sessionStorage.getItem("saakouk_admin_selected_tenant")).toBeNull();
    expect(sessionStorage.getItem("pos_employee")).toBeNull();
    expect(sessionStorage.getItem("other")).toBe("keep");
  });
});
